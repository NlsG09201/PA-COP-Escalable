package com.COP_Escalable.Backend.budget.application;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.math.BigDecimal;

@ConfigurationProperties("app.budget")
public class BudgetProperties {

	private String currency = "COP";
	private BigDecimal taxRate = new BigDecimal("0.19");

	public String getCurrency() { return currency; }
	public void setCurrency(String currency) { this.currency = currency; }

	public BigDecimal getTaxRate() { return taxRate; }
	public void setTaxRate(BigDecimal taxRate) { this.taxRate = taxRate; }
}
