-- Seed default environment components for Phase 3

INSERT INTO environment_components (name, slug, category, affects_tracking, setup_instructions)
VALUES
  ('Resistance Band', 'resistance_band', 'equipment', FALSE, 'Anchor band securely at hip or knee height.'),
  ('Exercise Bench', 'bench', 'equipment', FALSE, 'Place bench on stable, level surface.'),
  ('Box / Platform', 'box_squat', 'equipment', TRUE, 'Position box behind patient; ensure stable footing.'),
  ('Olympic Bar', 'olympic_bar', 'equipment', TRUE, 'Use collars; maintain clear rack space.'),
  ('Dumbbells', 'dumbbells', 'equipment', TRUE, 'Select appropriate weight; keep within camera frame.'),
  ('Wall Mirror', 'mirror', 'distraction', FALSE, 'Mirror may affect depth perception; note if present.'),
  ('Crowded Space', 'crowded_gym', 'distraction', TRUE, 'Other people may occlude landmarks.'),
  ('Clear Floor Space', 'clear_floor', 'setup', FALSE, 'Ensure 2m clear radius around exercise area.')
ON CONFLICT (slug) DO NOTHING;
