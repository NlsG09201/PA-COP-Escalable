package com.COP_Escalable.Backend.shared.infrastructure;

public final class StreamEventTypes {

	private StreamEventTypes() {}

	public static final String DIAGNOSIS_REQUESTS = "cop:diagnosis:requests";
	public static final String DIAGNOSIS_RESULTS = "cop:diagnosis:results";

	public static final String EMOTION_REQUESTS = "cop:emotion:requests";
	public static final String EMOTION_RESULTS = "cop:emotion:results";

	public static final String RECOMMENDATION_REQUESTS = "cop:recommendation:requests";
	public static final String RECOMMENDATION_RESULTS = "cop:recommendation:results";

	public static final String FOLLOWUP_EVENTS = "cop:followup:events";
	public static final String COPILOT_EVENTS = "cop:copilot:events";
	public static final String EXPERIENCE_EVENTS = "cop:experience:events";
}
