from rest_framework.routers import DefaultRouter

from .views import MonitorViewSet

router = DefaultRouter()
router.register("monitors", MonitorViewSet, basename="monitor")

urlpatterns = router.urls
