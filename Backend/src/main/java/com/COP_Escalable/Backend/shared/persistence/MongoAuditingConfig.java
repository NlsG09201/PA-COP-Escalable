package com.COP_Escalable.Backend.shared.persistence;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.core.mapping.event.BeforeConvertCallback;

@Configuration
@EnableMongoAuditing
public class MongoAuditingConfig {

	@Bean
	BeforeConvertCallback<Object> mongoEnsureUuidOnInsert() {
		return (entity, collection) -> {
			if (entity instanceof AuditableEntity ae) {
				ae.ensureId();
			}
			return entity;
		};
	}
}
