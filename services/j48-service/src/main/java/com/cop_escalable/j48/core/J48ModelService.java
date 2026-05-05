package com.cop_escalable.j48.core;

import com.cop_escalable.j48.config.J48Properties;
import jakarta.annotation.PostConstruct;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.file.Files;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.springframework.stereotype.Service;
import weka.classifiers.Classifier;
import weka.classifiers.trees.J48;
import weka.core.Attribute;
import weka.core.DenseInstance;
import weka.core.Instance;
import weka.core.Instances;
import weka.core.SerializationHelper;
import weka.core.converters.ConverterUtils.DataSource;

@Service
public class J48ModelService {
  private final J48Properties props;

  private volatile Classifier classifier;
  private volatile Instances header;

  public J48ModelService(J48Properties props) {
    this.props = props;
  }

  @PostConstruct
  public void init() throws Exception {
    var modelFile = new File(props.modelPath());
    if (modelFile.exists()) {
      loadModel(modelFile);
      return;
    }

    if (!props.autoTrain()) {
      throw new IllegalStateException("Model not found and autoTrain=false: " + props.modelPath());
    }

    trainAndPersist();
  }

  public synchronized Map<String, Object> trainAndPersist() throws Exception {
    var arff = new File(props.arffPath());
    if (!arff.exists()) {
      throw new IllegalStateException("ARFF file not found: " + props.arffPath());
    }

    Instances data = DataSource.read(arff.getAbsolutePath());
    if (data.classIndex() < 0) {
      data.setClassIndex(data.numAttributes() - 1);
    }

    var j48 = new J48();
    j48.buildClassifier(data);

    this.classifier = j48;
    this.header = new Instances(data, 0);

    var modelFile = new File(props.modelPath());
    Files.createDirectories(modelFile.toPath().getParent());
    try (var out = new BufferedOutputStream(new FileOutputStream(modelFile))) {
      SerializationHelper.write(out, new Object[] { this.classifier, this.header });
    }

    return Map.of(
      "ok", true,
      "trainedOn", data.numInstances(),
      "attributes", data.numAttributes(),
      "classAttribute", data.classAttribute().name(),
      "modelPath", modelFile.getAbsolutePath()
    );
  }

  public Map<String, Object> predict(Map<String, Object> features) throws Exception {
    var localClassifier = Objects.requireNonNull(classifier, "classifier not loaded");
    var localHeader = Objects.requireNonNull(header, "header not loaded");

    Instance inst = new DenseInstance(localHeader.numAttributes());
    inst.setDataset(localHeader);

    for (int i = 0; i < localHeader.numAttributes(); i++) {
      Attribute attr = localHeader.attribute(i);
      if (i == localHeader.classIndex()) continue;

      Object raw = features.get(attr.name());
      if (raw == null) {
        inst.setMissing(attr);
        continue;
      }

      if (attr.isNumeric()) {
        inst.setValue(attr, toDouble(raw).orElse(Double.NaN));
        continue;
      }

      // nominal or string
      String s = String.valueOf(raw);
      if (attr.isNominal()) {
        int idx = attr.indexOfValue(s);
        if (idx < 0) {
          // Unknown value -> missing
          inst.setMissing(attr);
        } else {
          inst.setValue(attr, s);
        }
      } else {
        inst.setValue(attr, s);
      }
    }

    double clsIndex = localClassifier.classifyInstance(inst);
    String clsLabel = localHeader.classAttribute().value((int) clsIndex);
    double[] dist = localClassifier.distributionForInstance(inst);

    Map<String, Double> probabilities = new LinkedHashMap<>();
    Attribute classAttr = localHeader.classAttribute();
    for (int i = 0; i < classAttr.numValues() && i < dist.length; i++) {
      probabilities.put(classAttr.value(i), dist[i]);
    }

    return Map.of(
      "classLabel", clsLabel,
      "classIndex", clsIndex,
      "probabilities", probabilities
    );
  }

  public Map<String, Object> info() {
    var localHeader = this.header;
    if (localHeader == null) return Map.of("ready", false);
    return Map.of(
      "ready", true,
      "attributes", localHeader.numAttributes(),
      "classAttribute", localHeader.classAttribute().name()
    );
  }

  private void loadModel(File modelFile) throws Exception {
    try (var in = new BufferedInputStream(new FileInputStream(modelFile))) {
      Object[] payload = (Object[]) SerializationHelper.read(in);
      this.classifier = (Classifier) payload[0];
      this.header = (Instances) payload[1];
      if (this.header.classIndex() < 0) {
        this.header.setClassIndex(this.header.numAttributes() - 1);
      }
    }
  }

  private Optional<Double> toDouble(Object raw) {
    if (raw instanceof Number n) return Optional.of(n.doubleValue());
    try {
      return Optional.of(Double.parseDouble(String.valueOf(raw)));
    } catch (Exception ignored) {
      return Optional.empty();
    }
  }
}

