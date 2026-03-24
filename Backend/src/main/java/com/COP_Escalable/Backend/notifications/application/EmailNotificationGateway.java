package com.COP_Escalable.Backend.notifications.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailNotificationGateway {
	private static final Logger log = LoggerFactory.getLogger(EmailNotificationGateway.class);

	private final NotificationProperties properties;
	private final ObjectProvider<JavaMailSender> mailSenderProvider;

	public EmailNotificationGateway(
			NotificationProperties properties,
			ObjectProvider<JavaMailSender> mailSenderProvider
	) {
		this.properties = properties;
		this.mailSenderProvider = mailSenderProvider;
	}

	public ChannelDispatchResult send(RenderedNotification notification) {
		if (!properties.email().enabled()) {
			return ChannelDispatchResult.skipped("Email notifications are disabled");
		}
		if (!hasText(notification.recipient())) {
			return ChannelDispatchResult.skipped("Missing email recipient");
		}

		if (!"SMTP".equalsIgnoreCase(properties.email().provider())) {
			log.info(
					"Email notification {} sent to {} with subject {}",
					notification.templateCode(),
					notification.recipient(),
					notification.subject()
			);
			return ChannelDispatchResult.sent("log-email-" + notification.outboxMessageId() + "-" + notification.channel().name().toLowerCase());
		}

		var mailSender = mailSenderProvider.getIfAvailable();
		if (mailSender == null) {
			return ChannelDispatchResult.failed("SMTP provider selected but JavaMailSender is not available");
		}

		try {
			var message = new SimpleMailMessage();
			message.setFrom(properties.email().fromAddress());
			message.setTo(notification.recipient());
			message.setSubject(notification.subject());
			message.setText(notification.messageBody());
			mailSender.send(message);
			return ChannelDispatchResult.sent("smtp-email-" + notification.outboxMessageId() + "-" + notification.channel().name().toLowerCase());
		} catch (MailException ex) {
			return ChannelDispatchResult.failed(ex.getMessage());
		}
	}

	private static boolean hasText(String value) {
		return value != null && !value.isBlank();
	}
}
