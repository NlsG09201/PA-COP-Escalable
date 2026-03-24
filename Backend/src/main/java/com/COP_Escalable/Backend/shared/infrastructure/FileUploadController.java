package com.COP_Escalable.Backend.shared.infrastructure;

import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/files")
public class FileUploadController {

	private final GridFsStorageService storageService;

	public FileUploadController(GridFsStorageService storageService) {
		this.storageService = storageService;
	}

	@PostMapping("/upload")
	public ResponseEntity<Map<String, String>> upload(@RequestParam("file") MultipartFile file) throws IOException {
		if (file.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File is empty");
		}

		String fileId = storageService.store(
				file.getInputStream(),
				file.getOriginalFilename(),
				file.getContentType()
		);

		return ResponseEntity.ok(Map.of(
				"fileId", fileId,
				"filename", file.getOriginalFilename() != null ? file.getOriginalFilename() : "unknown",
				"contentType", file.getContentType() != null ? file.getContentType() : "application/octet-stream",
				"size", String.valueOf(file.getSize())
		));
	}

	@GetMapping("/{fileId}")
	public ResponseEntity<byte[]> download(@PathVariable String fileId) throws IOException {
		GridFsResource resource = storageService.load(fileId)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found"));

		byte[] data = resource.getInputStream().readAllBytes();

		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.parseMediaType(
				resource.getContentType() != null ? resource.getContentType() : "application/octet-stream"
		));
		headers.setContentLength(data.length);
		headers.setContentDispositionFormData("attachment", resource.getFilename());

		return new ResponseEntity<>(data, headers, HttpStatus.OK);
	}

	@DeleteMapping("/{fileId}")
	public ResponseEntity<Void> delete(@PathVariable String fileId) {
		if (!storageService.exists(fileId)) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found");
		}
		storageService.delete(fileId);
		return ResponseEntity.noContent().build();
	}
}
