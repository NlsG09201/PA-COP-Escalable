package com.cop_escalable.j48.dto;

import java.util.List;

public record ModelInfoResponse(
  boolean ready,
  Integer attributes,
  String classAttribute,
  List<String> classLabels
) {
  public static ModelInfoResponse notReady() {
    return new ModelInfoResponse(false, null, null, List.of());
  }
}
