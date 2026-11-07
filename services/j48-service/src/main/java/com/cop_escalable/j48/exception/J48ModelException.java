package com.cop_escalable.j48.exception;

public class J48ModelException extends RuntimeException {
  public J48ModelException(String message) {
    super(message);
  }

  public J48ModelException(String message, Throwable cause) {
    super(message, cause);
  }
}
