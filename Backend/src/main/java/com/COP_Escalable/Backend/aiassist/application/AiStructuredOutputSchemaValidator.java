package com.COP_Escalable.Backend.aiassist.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class AiStructuredOutputSchemaValidator {

	private final JsonSchema schema;

	public AiStructuredOutputSchemaValidator() {
		JsonSchemaFactory factory = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012);
		try (InputStream is = new ClassPathResource("ai-assist/output-schema-v1.json").getInputStream()) {
			this.schema = factory.getSchema(is);
		} catch (Exception e) {
			throw new IllegalStateException("Could not load ai-assist/output-schema-v1.json", e);
		}
	}

	public void validateOrThrow(JsonNode node) {
		Set<ValidationMessage> errors = schema.validate(node);
		if (!errors.isEmpty()) {
			String msg = errors.stream().map(ValidationMessage::getMessage).collect(Collectors.joining("; "));
			throw new AiOutputSchemaValidationException(msg);
		}
	}
}
