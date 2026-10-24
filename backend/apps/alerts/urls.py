from rest_framework.routers import DefaultRouter

from .views import AlertChannelViewSet

router = DefaultRouter()
router.register("alert-channels", AlertChannelViewSet, basename="alert-channel")

urlpatterns = router.urls
