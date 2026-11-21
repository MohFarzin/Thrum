from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Profile

User = get_user_model()


def _ensure_profile(user) -> Profile:
    profile, _ = Profile.objects.get_or_create(
        user=user,
        defaults={"is_approved": bool(user.is_staff or user.is_superuser)},
    )
    return profile


class UserSerializer(serializers.ModelSerializer):
    is_approved = serializers.SerializerMethodField()
    is_staff = serializers.BooleanField(read_only=True)
    is_admin = serializers.SerializerMethodField()
    date_joined = serializers.DateTimeField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "is_approved",
            "is_staff",
            "is_admin",
            "is_active",
            "date_joined",
        ]

    def get_is_approved(self, obj) -> bool:
        if obj.is_staff:
            return True
        profile = getattr(obj, "profile", None)
        if profile is None:
            profile = _ensure_profile(obj)
        return bool(profile.is_approved)

    def get_is_admin(self, obj) -> bool:
        # "Admin" badge — staff only; never invent roles client-side.
        return bool(obj.is_staff)


class AdminUserSerializer(serializers.ModelSerializer):
    is_approved = serializers.SerializerMethodField()
    is_admin = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "is_approved",
            "is_staff",
            "is_admin",
            "is_active",
            "date_joined",
            "last_login",
        ]

    def get_is_approved(self, obj) -> bool:
        if obj.is_staff:
            return True
        profile = getattr(obj, "profile", None)
        return bool(profile and profile.is_approved)

    def get_is_admin(self, obj) -> bool:
        return bool(obj.is_staff)


class RegisterSerializer(serializers.Serializer):
    username = serializers.RegexField(
        regex=r"^[A-Za-z0-9_.-]{3,32}$",
        max_length=32,
        error_messages={
            "invalid": "Username: 3–32 chars, letters, numbers, _ . - only.",
        },
    )
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)

    def validate_username(self, value):
        value = value.strip()
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Username already taken.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            email=(validated_data.get("email") or "").strip()[:254],
            password=validated_data["password"],
        )
        # New members wait for approval (signal may have created profile).
        profile, _ = Profile.objects.get_or_create(user=user)
        if not user.is_staff:
            profile.is_approved = False
            profile.save(update_fields=["is_approved", "updated_at"])
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, max_length=128)

    def validate(self, attrs):
        username = (attrs.get("username") or "").strip()
        user = authenticate(username=username, password=attrs["password"])
        if user is None:
            raise serializers.ValidationError("Invalid username or password.")
        if not user.is_active:
            raise serializers.ValidationError("Account is disabled.")
        attrs["user"] = user
        return attrs


class AdminSetPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)

    def validate_password(self, value):
        validate_password(value)
        return value


class AdminUserUpdateSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)
    is_staff = serializers.BooleanField(required=False)
    is_approved = serializers.BooleanField(required=False)
