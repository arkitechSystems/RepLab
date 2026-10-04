// Dated workout names. Since 2026-10-04 renames are linked: every rename
// (session pencil, Workouts page, editors) renames the template and clears
// sessions.custom_name for that workout. custom_name is legacy — left from the
// 2026-09-29 per-day rename — and is no longer written. Display rule kept for
// any remaining legacy rows: the day's custom_name if set, else the template's
// CURRENT name.

// LEFT JOIN LATERAL exposing `ds.custom_name` for a schedule-style row keyed by
// (user, template, DATE). sessions.date is TEXT 'YYYY-MM-DD', hence to_char.
// Newest row wins if a date somehow has two sessions for the same template.
export function DAY_SESSION_NAME_JOIN(userCol, templateCol, dateCol) {
  return `LEFT JOIN LATERAL (
         SELECT NULLIF(TRIM(s.custom_name), '') AS custom_name
           FROM sessions s
          WHERE s.user_id = ${userCol} AND s.template_id = ${templateCol}
            AND s.date = to_char(${dateCol}, 'YYYY-MM-DD')
            AND s.custom_name IS NOT NULL
          ORDER BY s.id DESC
          LIMIT 1
       ) ds ON TRUE`;
}

// SQL expression for a session row's display name. `sessionAlias` is the
// sessions alias, `templateNameExpr` the template's name column.
export function sessionDisplayNameSql(sessionAlias, templateNameExpr, fallback = 'Workout') {
  return `COALESCE(NULLIF(TRIM(${sessionAlias}.custom_name), ''), ${templateNameExpr}, '${fallback}')`;
}
