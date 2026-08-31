package com.cop_escalable.j48.web;

import static org.hamcrest.Matchers.hasKey;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.cop_escalable.j48.security.J48AdminTokenFilter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
  "j48.arffPath=src/test/resources/test-relapse.arff",
  "j48.modelPath=target/test-models/j48-controller-test.model",
  "j48.autoTrain=true",
  "j48.adminToken=test-admin-token",
  "j48.requireAdminToken=true",
  "j48.aiExplanationEnabled=true",
  "spring.ai.openai.api-key=test-key",
  "spring.ai.openai.chat.enabled=false",
  "spring.ai.model.audio.speech=none",
  "spring.ai.model.audio.transcription=none"
})
@AutoConfigureMockMvc
class J48ControllerTest {
  @Autowired
  private MockMvc mockMvc;

  @Test
  void predictsFromFlatFeaturePayload() throws Exception {
    mockMvc.perform(post("/predict")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "gender": "F",
            "age_group": "SENIOR",
            "sentiment": "NEGATIVE",
            "wellbeing": "LOW",
            "anxiety": 0.88,
            "depression": 0.72,
            "attendance": "IRREGULAR",
            "days_since_last": 50
          }
          """))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.classLabel").exists())
      .andExpect(jsonPath("$.probabilities", hasKey("HIGH")));
  }

  @Test
  void rejectsEmptyPredictionPayload() throws Exception {
    mockMvc.perform(post("/predict")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{}"))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.validationErrors").exists());
  }

  @Test
  void returnsFallbackExplanationWhenAiProviderIsDisabled() throws Exception {
    mockMvc.perform(post("/predict/explanation")
        .contentType(MediaType.APPLICATION_JSON)
        .content("""
          {
            "gender": "M",
            "age_group": "ADULT",
            "sentiment": "POSITIVE",
            "wellbeing": "HIGH",
            "anxiety": 0.10,
            "depression": 0.10,
            "attendance": "REGULAR",
            "days_since_last": 2,
            "patientName": "must-not-be-sent"
          }
          """))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.aiGenerated").value(false))
      .andExpect(jsonPath("$.safeInput.patientName").doesNotExist());
  }

  @Test
  void trainRequiresAdminToken() throws Exception {
    mockMvc.perform(post("/train"))
      .andExpect(status().isUnauthorized());
  }

  @Test
  void trainAcceptsConfiguredAdminToken() throws Exception {
    mockMvc.perform(post("/train")
        .header(J48AdminTokenFilter.ADMIN_TOKEN_HEADER, "test-admin-token"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.ok").value(true));
  }

  @Test
  void exposesModelInfo() throws Exception {
    mockMvc.perform(get("/info"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.ready").value(true))
      .andExpect(jsonPath("$.classAttribute").value("risk_level"));
  }
}
