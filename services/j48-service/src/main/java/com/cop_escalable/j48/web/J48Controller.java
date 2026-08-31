package com.cop_escalable.j48.web;

import com.cop_escalable.j48.core.ClinicalRiskExplanationService;
import com.cop_escalable.j48.core.J48ModelService;
import com.cop_escalable.j48.dto.AiExplanationResponse;
import com.cop_escalable.j48.dto.ModelInfoResponse;
import com.cop_escalable.j48.dto.PredictRequest;
import com.cop_escalable.j48.dto.PredictionResponse;
import com.cop_escalable.j48.dto.TrainingResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "J48 relapse risk")
public class J48Controller {
  private final J48ModelService model;
  private final ClinicalRiskExplanationService explanations;

  public J48Controller(J48ModelService model, ClinicalRiskExplanationService explanations) {
    this.model = model;
    this.explanations = explanations;
  }

  @GetMapping("/health")
  @Operation(summary = "Service liveness probe")
  public Map<String, Object> health() {
    return Map.of("ok", true);
  }

  @GetMapping("/info")
  @Operation(summary = "Return current J48 model metadata")
  public ModelInfoResponse info() {
    return model.info();
  }

  @PostMapping("/predict")
  @Operation(summary = "Predict psychology relapse risk with the trained J48 model")
  @ApiResponse(responseCode = "200", description = "Prediction generated")
  @ApiResponse(responseCode = "400", description = "Invalid input")
  @ApiResponse(responseCode = "503", description = "Model is not ready")
  public PredictionResponse predict(@Valid @RequestBody PredictRequest request) {
    return model.predict(request.features());
  }

  @PostMapping("/predict/explanation")
  @Operation(summary = "Predict risk and explain the result with Spring AI when configured")
  @ApiResponse(responseCode = "200", description = "Prediction and explanation generated")
  @ApiResponse(responseCode = "502", description = "AI provider error")
  public AiExplanationResponse explain(@Valid @RequestBody PredictRequest request) {
    PredictionResponse prediction = model.predict(request.features());
    return explanations.explain(request.features(), prediction);
  }

  @PostMapping("/train")
  @Operation(
    summary = "Retrain and persist the J48 model",
    security = @SecurityRequirement(name = "j48AdminToken")
  )
  @ApiResponse(responseCode = "200", description = "Model trained")
  @ApiResponse(responseCode = "401", description = "Admin token required")
  @ApiResponse(responseCode = "403", description = "Invalid admin token")
  public TrainingResponse train() {
    return model.trainAndPersist();
  }
}
