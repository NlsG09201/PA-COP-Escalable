package com.cop_escalable.j48.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "j48")
public record J48Properties(
  String arffPath,
  String modelPath,
  boolean autoTrain
) {}

