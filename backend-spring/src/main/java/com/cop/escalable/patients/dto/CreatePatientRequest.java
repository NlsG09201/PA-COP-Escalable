package com.cop.escalable.patients.dto;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
public record CreatePatientRequest(String external_code, @NotBlank String full_name, String birth_date, @Pattern(regexp = "M|F|O", message = "gender must be M, F or O") String gender, String phone, @Email String email) {}
