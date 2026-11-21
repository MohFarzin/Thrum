from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CircuitViewSet, MonitorViewSet, public_circuit_status, public_status

router = DefaultRouter()
router.register("monitors", MonitorViewSet, basename="monitor")
router.register("circuits", CircuitViewSet, basename="circuit")

urlpatterns = [
    path("public/status/<str:slug>/", public_status, name="public-status"),
    path("public/circuit/<str:slug>/", public_circuit_status, name="public-circuit-status"),
    *router.urls,
]
