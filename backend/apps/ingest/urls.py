from django.urls import path

from .views import HeartbeatIngestView

urlpatterns = [
    path(
        "v1/heartbeat/<uuid:monitor_id>/",
        HeartbeatIngestView.as_view(),
        name="heartbeat-ingest",
    ),
]
