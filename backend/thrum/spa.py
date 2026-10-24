from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404
from django.views import View


class SpaIndexView(View):
    """Serve the React index.html for client-side routes (egg / WhiteNoise mode)."""

    def get(self, request, *_args, **_kwargs):
        root = getattr(settings, "WHITENOISE_ROOT", None)
        if not root:
            raise Http404("SPA not built")
        index = Path(root) / "index.html"
        if not index.is_file():
            raise Http404("index.html missing")
        response = FileResponse(index.open("rb"), content_type="text/html; charset=utf-8")
        # Always revalidate — must match the current asset hashes on disk.
        response["Cache-Control"] = "no-store"
        return response
