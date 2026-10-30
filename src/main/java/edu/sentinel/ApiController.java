package edu.sentinel;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class ApiController {

    private static final Set<String> CATEGORIES = Set.of(
            "Violence", "Weapon", "Accident", "Fire / smoke", "Fall", "Demo alert");
    private static final Set<String> REVIEW_STATES = Set.of("confirmed", "false_alarm");
    private final JdbcTemplate jdbc;

    public ApiController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok", "detector", "not_configured");
    }

    @GetMapping("/cameras")
    public List<Map<String, Object>> cameras() {
        return jdbc.queryForList("SELECT * FROM cameras ORDER BY id DESC");
    }

    @PostMapping("/cameras")
    public ResponseEntity<Map<String, Object>> addCamera(@RequestBody CameraInput input) {
        String name = clean(input.name(), "Camera name", 80);
        String source = clean(input.source(), "Camera source", 500);
        Map<String, Object> created = jdbc.queryForMap(
                "INSERT INTO cameras(name, source, created_at) VALUES (?, ?, ?) RETURNING *",
                name, source, Instant.now().toString());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @DeleteMapping("/cameras/{id}")
    public ResponseEntity<Void> deleteCamera(@PathVariable long id) {
        jdbc.update("UPDATE incidents SET camera_id = NULL WHERE camera_id = ?", id);
        int deleted = jdbc.update("DELETE FROM cameras WHERE id = ?", id);
        if (deleted == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Camera not found");
        }
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/incidents")
    public List<Map<String, Object>> incidents() {
        return jdbc.queryForList("SELECT * FROM incidents ORDER BY id DESC LIMIT 200");
    }

    @PostMapping("/incidents")
    public ResponseEntity<Map<String, Object>> createIncident(@RequestBody(required = false) IncidentInput input) {
        IncidentInput value = input == null ? new IncidentInput(null, null) : input;
        String category = value.category() == null ? "Demo alert" : value.category();
        if (!CATEGORIES.contains(category)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported incident category");
        }

        Long cameraId = value.camera_id();
        String cameraName = "Demo source";
        if (cameraId != null) {
            List<Map<String, Object>> camera = jdbc.queryForList("SELECT id, name FROM cameras WHERE id = ?", cameraId);
            if (camera.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Camera not found");
            }
            cameraName = String.valueOf(camera.get(0).get("name"));
        }

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(jdbc.queryForMap("""
                        INSERT INTO incidents(camera_id,camera_name,category,confidence,severity,status,created_at)
                        VALUES(?,?,?,?,?,?,?) RETURNING *
                        """, cameraId, cameraName, category, 0.0, "Review", "pending", Instant.now().toString()));
    }

    @PostMapping("/incidents/demo")
    @Transactional
    public ResponseEntity<List<Map<String, Object>>> createDemoIncidents() {
        List<Map<String, Object>> cameras = jdbc.queryForList("SELECT id, name FROM cameras ORDER BY id DESC");
        List<Map<String, Object>> created = new java.util.ArrayList<>();
        List<String> categories = List.of("Violence", "Weapon", "Accident");
        for (int i = 0; i < categories.size(); i++) {
            Long cameraId = null;
            String cameraName = "Demo source";
            if (!cameras.isEmpty()) {
                Map<String, Object> camera = cameras.get(i % cameras.size());
                cameraId = ((Number) camera.get("id")).longValue();
                cameraName = String.valueOf(camera.get("name"));
            }
            created.add(jdbc.queryForMap("""
                    INSERT INTO incidents(camera_id,camera_name,category,confidence,severity,status,created_at)
                    VALUES(?,?,?,?,?,?,?) RETURNING *
                    """, cameraId, cameraName, categories.get(i), 0.0, "Review", "pending", Instant.now().toString()));
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PatchMapping("/incidents/{id}")
    public Map<String, Object> reviewIncident(@PathVariable long id, @RequestParam String status) {
        if (!REVIEW_STATES.contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status must be confirmed or false_alarm");
        }
        int changed = jdbc.update("UPDATE incidents SET status = ? WHERE id = ?", status, id);
        if (changed == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Incident not found");
        }
        return jdbc.queryForMap("SELECT * FROM incidents WHERE id = ?", id);
    }

    private static String clean(String raw, String field, int maxLength) {
        String value = raw == null ? "" : raw.strip();
        if (value.isEmpty() || value.length() > maxLength) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " must be between 1 and " + maxLength + " characters");
        }
        return value;
    }

    public record CameraInput(String name, String source) {

    }

    public record IncidentInput(Long camera_id, String category) {

    }
}
