from . import __version__ as app_version

app_name = "car_agents_crm"
app_title = "CAR-AGENTS CRM"
app_publisher = "CAR-AGENTS"
app_description = "Custom Frappe CRM extension for CAR-AGENTS automotive brokerage"
app_email = "info@car-agents.de"
app_license = "MIT"
required_apps = ["frappe", "crm"]

# ─── Document Events (Hooks) ──────────────────────────────────────────────────
# Fires Python logic on Frappe document lifecycle events
doc_events = {
    "CRM Lead": {
        "after_insert": "car_agents_crm.hooks_logic.lead_hooks.on_lead_insert",
        "on_update": "car_agents_crm.hooks_logic.lead_hooks.on_lead_update",
    },
    "CRM Deal": {
        "on_update": "car_agents_crm.hooks_logic.deal_hooks.on_deal_update",
    },
}

# ─── Scheduled Tasks ──────────────────────────────────────────────────────────
scheduler_events = {
    "daily": [
        "car_agents_crm.tasks.inactivity_check.run_inactivity_check",   # W6
        "car_agents_crm.tasks.executive_briefing.send_daily_briefing",   # W5
    ],
    "weekly": [
        "car_agents_crm.tasks.executive_briefing.send_weekly_briefing",  # W5
    ],
}

# ─── Website Route Rules ──────────────────────────────────────────────────────
# Expose custom web portal pages
website_route_rules = [
    {"from_route": "/car-agents-portal", "to_route": "car-agents-portal"},
]

# ─── Fixtures ─────────────────────────────────────────────────────────────────
# Export custom fields, print formats, and workflows with the app
fixtures = [
    {"dt": "Custom Field"},
    {"dt": "Property Setter"},
    {"dt": "Print Format", "filters": [["module", "=", "Car Agents CRM"]]},
    {"dt": "Workflow", "filters": [["module", "=", "Car Agents CRM"]]},
]
