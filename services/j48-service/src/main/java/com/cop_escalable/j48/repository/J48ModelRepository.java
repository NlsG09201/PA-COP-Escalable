package com.cop_escalable.j48.repository;

import com.cop_escalable.j48.config.J48Properties;
import com.cop_escalable.j48.exception.J48ModelException;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.stereotype.Repository;
import weka.classifiers.Classifier;
import weka.core.Instances;
import weka.core.SerializationHelper;

@Repository
public class J48ModelRepository {
  private final J48Properties props;

  public J48ModelRepository(J48Properties props) {
    this.props = props;
  }

  public Path arffPath() {
    return Path.of(props.arffPath());
  }

  public Path modelPath() {
    return Path.of(props.modelPath());
  }

  public boolean modelExists() {
    return Files.exists(modelPath());
  }

  public StoredModel load() {
    try (var in = new BufferedInputStream(new FileInputStream(modelPath().toFile()))) {
      Object[] payload = (Object[]) SerializationHelper.read(in);
      var classifier = (Classifier) payload[0];
      var header = (Instances) payload[1];
      if (header.classIndex() < 0) {
        header.setClassIndex(header.numAttributes() - 1);
      }
      return new StoredModel(classifier, header);
    } catch (Exception ex) {
      throw new J48ModelException("Unable to load J48 model from " + modelPath(), ex);
    }
  }

  public void save(Classifier classifier, Instances header) {
    try {
      Path parent = modelPath().getParent();
      if (parent != null) {
        Files.createDirectories(parent);
      }
      try (var out = new BufferedOutputStream(new FileOutputStream(modelPath().toFile()))) {
        SerializationHelper.write(out, new Object[] { classifier, header });
      }
    } catch (Exception ex) {
      throw new J48ModelException("Unable to persist J48 model to " + modelPath(), ex);
    }
  }

  public record StoredModel(Classifier classifier, Instances header) {}
}
