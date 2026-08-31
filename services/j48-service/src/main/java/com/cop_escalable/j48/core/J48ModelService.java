package com.cop_escalable.j48.core;

import com.cop_escalable.j48.config.J48Properties;
import com.cop_escalable.j48.dto.ModelInfoResponse;
import com.cop_escalable.j48.dto.PredictionResponse;
import com.cop_escalable.j48.dto.TrainingResponse;
import com.cop_escalable.j48.exception.InvalidPredictionRequestException;
import com.cop_escalable.j48.exception.J48ModelException;
import com.cop_escalable.j48.exception.ModelNotReadyException;
import com.cop_escalable.j48.repository.J48ModelRepository;
import jakarta.annotation.PostConstruct;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import weka.classifiers.Classifier;
import weka.classifiers.trees.J48;
import weka.core.Attribute;
import weka.core.DenseInstance;
import weka.core.Instance;
import weka.core.Instances;
import weka.core.converters.ConverterUtils.DataSource;

@Service
public class J48ModelService {
  private final J48Properties props;
  private final J48ModelRepository repository;

  private volatile Classifier classifier;
  private volatile Instances header;

  public J48ModelService(J48Properties props, J48ModelRepository repository) {
    this.props = props;
    this.repository = repository;
  }

  @PostConstruct
  public void init() {
    if (repository.modelExists()) {
      loadModel();
      return;
    }

    if (!props.autoTrain()) {
      throw new J48ModelException("Model not found and autoTrain=false: " + repository.modelPath());
    }

    trainAndPersist();
  }

  public synchronized TrainingResponse trainAndPersist() {
    if (!Files.exists(repository.arffPath())) {
      throw new J48ModelException("ARFF file not found: " + repository.arffPath());
    }

    try {
      Instances data = DataSource.read(repository.arffPath().toAbsolutePath().toString());
      if (data.classIndex() < 0) {
        data.setClassIndex(data.numAttributes() - 1);
      }

      var j48 = new J48();
      j48.buildClassifier(data);

      this.classifier = j48;
      this.header = new Instances(data, 0);
      repository.save(this.classifier, this.header);

      return new TrainingResponse(
        true,
        data.numInstances(),
        data.numAttributes(),
        data.classAttribute().name(),
        repository.modelPath().toAbsolutePath().toString()
      );
    } catch (J48ModelException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new J48ModelException("Unable to train J48 model", ex);
    }
  }

  public PredictionResponse predict(Map<String, Object> features) {
    if (features == null || features.isEmpty()) {
      throw new InvalidPredictionRequestException("At least one feature is required");
    }

    var localClassifier = classifier;
    var localHeader = header;
    if (localClassifier == null || localHeader == null) {
      throw new ModelNotReadyException("J48 model is not loaded");
    }

    try {
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

        String value = String.valueOf(raw);
        if (attr.isNominal()) {
          int idx = attr.indexOfValue(value);
          if (idx < 0) {
            inst.setMissing(attr);
          } else {
            inst.setValue(attr, value);
          }
        } else {
          inst.setValue(attr, value);
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

      return new PredictionResponse(clsLabel, clsIndex, probabilities);
    } catch (Exception ex) {
      throw new J48ModelException("Unable to predict relapse risk", ex);
    }
  }

  public ModelInfoResponse info() {
    var localHeader = this.header;
    if (localHeader == null) return ModelInfoResponse.notReady();
    return new ModelInfoResponse(
      true,
      localHeader.numAttributes(),
      localHeader.classAttribute().name(),
      classLabels(localHeader.classAttribute())
    );
  }

  private void loadModel() {
    var stored = repository.load();
    this.classifier = stored.classifier();
    this.header = stored.header();
  }

  private List<String> classLabels(Attribute classAttribute) {
    List<String> labels = new ArrayList<>();
    for (int i = 0; i < classAttribute.numValues(); i++) {
      labels.add(classAttribute.value(i));
    }
    return labels;
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
