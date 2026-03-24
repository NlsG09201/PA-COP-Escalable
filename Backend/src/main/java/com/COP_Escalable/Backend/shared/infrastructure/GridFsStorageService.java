package com.COP_Escalable.Backend.shared.infrastructure;

import com.mongodb.client.gridfs.model.GridFSFile;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Optional;

@Service
public class GridFsStorageService {

	private final GridFsTemplate gridFsTemplate;

	public GridFsStorageService(GridFsTemplate gridFsTemplate) {
		this.gridFsTemplate = gridFsTemplate;
	}

	public String store(byte[] data, String filename, String contentType) {
		ObjectId id = gridFsTemplate.store(
				new ByteArrayInputStream(data),
				filename,
				contentType
		);
		return id.toHexString();
	}

	public String store(InputStream inputStream, String filename, String contentType) {
		ObjectId id = gridFsTemplate.store(inputStream, filename, contentType);
		return id.toHexString();
	}

	public Optional<GridFsResource> load(String fileId) {
		GridFSFile file = gridFsTemplate.findOne(
				new Query(Criteria.where("_id").is(new ObjectId(fileId)))
		);
		if (file == null) {
			return Optional.empty();
		}
		return Optional.of(gridFsTemplate.getResource(file));
	}

	public byte[] loadAsBytes(String fileId) throws IOException {
		return load(fileId)
				.map(resource -> {
					try {
						return resource.getInputStream().readAllBytes();
					} catch (IOException e) {
						throw new RuntimeException("Failed to read GridFS file: " + fileId, e);
					}
				})
				.orElseThrow(() -> new IOException("GridFS file not found: " + fileId));
	}

	public void delete(String fileId) {
		gridFsTemplate.delete(
				new Query(Criteria.where("_id").is(new ObjectId(fileId)))
		);
	}

	public boolean exists(String fileId) {
		return gridFsTemplate.findOne(
				new Query(Criteria.where("_id").is(new ObjectId(fileId)))
		) != null;
	}
}
