package com.COP_Escalable.Backend.iam.config;

import com.COP_Escalable.Backend.shared.tenancy.TenantContextFilter;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.util.matcher.RegexRequestMatcher;

import java.security.KeyPair;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;

@Configuration
@EnableMethodSecurity
@EnableConfigurationProperties(SecurityProperties.class)
public class SecurityConfig {

	@Bean
	PasswordEncoder passwordEncoder() {
		return org.springframework.security.crypto.factory.PasswordEncoderFactories.createDelegatingPasswordEncoder();
	}

	@Bean
	KeyPair jwtKeyPair(SecurityProperties props) {
		return RsaKeyMaterial.resolveOrGenerate(props);
	}

	@Bean
	JWKSource<SecurityContext> jwkSource(SecurityProperties props, KeyPair jwtKeyPair) {
		RSAPublicKey publicKey = (RSAPublicKey) jwtKeyPair.getPublic();
		RSAPrivateKey privateKey = (RSAPrivateKey) jwtKeyPair.getPrivate();
		var rsaKey = new RSAKey.Builder(publicKey)
				.privateKey(privateKey)
				.keyID(props.jwt() != null ? props.jwt().keyId() : "local-dev-1")
				.build();
		return new ImmutableJWKSet<>(new JWKSet(rsaKey));
	}

	@Bean
	JwtDecoder jwtDecoder(KeyPair jwtKeyPair) {
		return NimbusJwtDecoder.withPublicKey((RSAPublicKey) jwtKeyPair.getPublic()).build();
	}

	@Bean
	JwtEncoder jwtEncoder(JWKSource<SecurityContext> jwkSource) {
		return new NimbusJwtEncoder(jwkSource);
	}

	@Bean
	TenantContextFilter tenantContextFilter() {
		return new TenantContextFilter();
	}

	@Bean
	@Order(0)
	SecurityFilterChain authSecurityFilterChain(HttpSecurity http) throws Exception {
		http
				.securityMatcher("/api/auth/**")
				.csrf(csrf -> csrf.disable())
				.cors(Customizer.withDefaults())
				.authorizeHttpRequests(auth -> auth.anyRequest().permitAll());

		return http.build();
	}

	@Bean
	@Order(1)
	SecurityFilterChain apiSecurityFilterChain(HttpSecurity http, TenantContextFilter tenantFilter) throws Exception {
		http
				.securityMatcher("/**")
				.csrf(csrf -> csrf.disable())
				.cors(Customizer.withDefaults())
				.authorizeHttpRequests(auth -> auth
						.requestMatchers(new RegexRequestMatcher("^/actuator/health(/.*)?$", null)).permitAll()
						.requestMatchers(new RegexRequestMatcher("^/actuator/info$", null)).permitAll()
						.requestMatchers(new RegexRequestMatcher("^/swagger(/.*)?$", null)).permitAll()
						.requestMatchers(new RegexRequestMatcher("^/v3/api-docs(/.*)?$", null)).permitAll()
						.requestMatchers(new RegexRequestMatcher("^/public(/.*)?$", null)).permitAll()
						.anyRequest().authenticated()
				)
				.oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
				.addFilterAfter(tenantFilter, org.springframework.security.web.authentication.AnonymousAuthenticationFilter.class);

		return http.build();
	}

	@Bean
	AuthenticationManager authenticationManager(
			com.COP_Escalable.Backend.iam.service.IamUserDetailsService uds,
			PasswordEncoder encoder
	) {
		var provider = new DaoAuthenticationProvider(uds);
		provider.setPasswordEncoder(encoder);
		return new ProviderManager(provider);
	}
}

