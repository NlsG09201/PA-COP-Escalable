package com.cop_escalable.j48.web;

import com.cop_escalable.j48.core.J48ModelService;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(produces = MediaType.APPLICATION_JSON_VALUE)
public class J48Controller {
  private final J48ModelService model;

  public J48Controller(J48ModelService model) {
    this.model = model;
  }

  @GetMapping("/health")
  public Map<String, Object> health() {
    return Map.of("ok", true);
  }

  @GetMapping("/info")
  public Map<String, Object> info() {
    return model.info();
  }

  @PostMapping("/predict")
  public Map<String, Object> predict(@RequestBody Map<String, Object> features) throws Exception {
    return model.predict(features);
  }

  @PostMapping("/train")
  public Map<String, Object> train() throws Exception {
    return model.trainAndPersist();
  }
}

