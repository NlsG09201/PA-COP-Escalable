package com.COP_Escalable.Backend.notifications.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;

@Service
public class WhatsappNotificationGateway {
	private static final Logger log = LoggerFactory.getLogger(WhatsappNotificationGateway.class);

	private final NotificationProperties properties;
	private final RestClient restClient;

	public WhatsappNotificationGateway(
			NotificationProperties properties,
			RestClient.Builder restClientBuilder
	) {
		this.properties = properties;
		this.restClient = restClientBuilder.build();
	}

	public ChannelDispatchResult send(RenderedNotification notification) {
		if (!properties.whatsapp().enabled()) {
			return ChannelDispatchResult.skipped("WhatsApp notifications are disabled");
		}
		if (!hasText(notification.recipient())) {
			return ChannelDispatchResult.skipped("Missing WhatsApp recipient");
		}

		if (!"CLOUD_API".equalsIgnoreCase(properties.whatsapp().provider())) {
			log.info(
					"WhatsApp notification {} sent to {} with body {}",
					notification.templateCode(),
					notification.recipient(),
					notification.messageBody()
			);
			return ChannelDispatchResult.sent("log-whatsapp-" + notification.outboxMessageId() + "-" + notification.channel().name().toLowerCase());
		}

		if (!hasText(properties.whatsapp().apiToken()) || !hasText(properties.whatsapp().phoneNumberId())) {
			return ChannelDispatchResult.failed("WhatsApp Cloud API credentials are incomplete");
		}

		try {
			var response = restClient.post()
					.uri(properties.whatsapp().baseUrl() + "/" + properties.whatsapp().phoneNumberId() + "/messages")
					.header(HttpHeaders.AUTHORIZATION, "Bearer " + properties.whatsapp().apiToken())
					.contentType(MediaType.APPLICATION_JSON)
					.body(new WhatsappCloudApiRequest(
							"whatsapp",
							notification.recipient(),
							"text",
							new WhatsappTextBody(false, notification.messageBody())
					))
					.retrieve()
					.body(WhatsappCloudApiResponse.class);

			String providerMessageId = response != null && response.messages() != null && !response.messages().isEmpty()
					? response.messages().get(0).id()
					: "cloud-api-whatsapp-" + notification.outboxMessageId();

			return ChannelDispatchResult.sent(providerMessageId);
		} catch (RestClientResponseException ex) {
			return ChannelDispatchResult.failed(ex.getResponseBodyAsString());
		} catch (RuntimeException ex) {
			return ChannelDispatchResult.failed(ex.getMessage());
		}
	}

	private static boolean hasText(String value) {
		return value != null && !value.isBlank();
	}

	private record WhatsappCloudApiRequest(
			String messaging_product,
			String to,
			String type,
			WhatsappTextBody text
	) {}

	private record WhatsappTextBody(
			boolean preview_url,
			String body
	) {}

	private record WhatsappCloudApiResponse(List<WhatsappCloudApiMessage> messages) {}

	private record WhatsappCloudApiMessage(String id) {}
}
