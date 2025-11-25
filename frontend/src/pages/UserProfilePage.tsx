// src/pages/UserProfilePage.tsx
import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getProfile, updateProfile } from "../lib/api";
import "./UserProfilePage.css";

type ProfileData = {
    user: { id: number; username: string };
    preferred_name: string;
    job_title: string;
    location: string;
    bio: string;
    avatar_url: string | null;
    departments: Array<{ id: number; name: string; slug: string }>;
};

export default function UserProfilePage() {
    const { userId } = useParams();
    const { user: authUser } = useAuth();

    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        preferred_name: "",
        job_title: "",
        location: "",
        bio: "",
    });
    const [avatarFile, setAvatarFile] = useState<File | null>(null);

    const isOwnProfile = !userId || (authUser && Number(userId) === authUser.id);

    useEffect(() => {
        loadProfile();
    }, [userId]);

    async function loadProfile() {
        setLoading(true);
        setError(null);
        try {
            const id = userId ? parseInt(userId, 10) : undefined;
            const data = await getProfile(id);
            setProfile(data);
            setFormData({
                preferred_name: data.preferred_name || "",
                job_title: data.job_title || "",
                location: data.location || "",
                bio: data.bio || "",
            });
        } catch (err: any) {
            console.error("Failed to load profile", err);
            setError("Failed to load profile.");
        } finally {
            setLoading(false);
        }
    }

    async function handleSave(e: FormEvent) {
        e.preventDefault();
        if (!isOwnProfile) return;

        setSubmitting(true);
        try {
            const data = new FormData();
            data.append("preferred_name", formData.preferred_name);
            data.append("job_title", formData.job_title);
            data.append("location", formData.location);
            data.append("bio", formData.bio);
            if (avatarFile) {
                data.append("avatar", avatarFile);
            }

            const updated = await updateProfile(data);
            setProfile(updated);
            setIsEditing(false);
            setAvatarFile(null);
        } catch (err: any) {
            console.error("Failed to update profile", err);
            alert("Failed to save profile changes.");
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) return <div className="page-wrapper"><p>Loading profile...</p></div>;
    if (error || !profile) return <div className="page-wrapper"><p className="error">{error || "Profile not found"}</p></div>;

    const displayName = profile.preferred_name || profile.user.username;

    return (
        <div className="page-wrapper user-profile-page">
            <div className="page-header">
                <h1>{isOwnProfile ? "Your Profile" : displayName}</h1>
            </div>

            <div className="profile-card">
                {!isEditing ? (
                    <div className="profile-view">
                        {profile.avatar_url ? (
                            <img src={profile.avatar_url} alt={displayName} className="profile-avatar-large" />
                        ) : (
                            <div className="profile-avatar-large">
                                {displayName.charAt(0).toUpperCase()}
                            </div>
                        )}

                        <div className="profile-info">
                            <h2>{displayName}</h2>
                            <div className="profile-meta">
                                {profile.job_title && <span>{profile.job_title}</span>}
                                {profile.job_title && profile.location && <span>•</span>}
                                {profile.location && <span>{profile.location}</span>}
                            </div>
                            {profile.bio && <p className="profile-bio">{profile.bio}</p>}

                            {profile.departments && profile.departments.length > 0 && (
                                <div className="profile-departments">
                                    {profile.departments.map(d => (
                                        <span key={d.id} className="dept-tag">{d.name}</span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {isOwnProfile && (
                            <button className="ks-btn-secondary" onClick={() => setIsEditing(true)}>
                                Edit Profile
                            </button>
                        )}
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="profile-edit-form">
                        <div className="form-row">
                            <label>Avatar</label>
                            <div className="avatar-upload">
                                {profile.avatar_url && <img src={profile.avatar_url} alt="Current" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={e => setAvatarFile(e.target.files?.[0] || null)}
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <label>Preferred Name</label>
                            <input
                                type="text"
                                value={formData.preferred_name}
                                onChange={e => setFormData({ ...formData, preferred_name: e.target.value })}
                                placeholder="e.g. Jane Doe"
                            />
                        </div>

                        <div className="form-row">
                            <label>Job Title</label>
                            <input
                                type="text"
                                value={formData.job_title}
                                onChange={e => setFormData({ ...formData, job_title: e.target.value })}
                                placeholder="e.g. Senior Engineer"
                            />
                        </div>

                        <div className="form-row">
                            <label>Location</label>
                            <input
                                type="text"
                                value={formData.location}
                                onChange={e => setFormData({ ...formData, location: e.target.value })}
                                placeholder="e.g. New York, NY"
                            />
                        </div>

                        <div className="form-row">
                            <label>Bio</label>
                            <textarea
                                rows={4}
                                value={formData.bio}
                                onChange={e => setFormData({ ...formData, bio: e.target.value })}
                                placeholder="Tell us a bit about yourself..."
                            />
                        </div>

                        <div className="form-actions">
                            <button
                                type="button"
                                className="ks-btn-secondary"
                                onClick={() => {
                                    setIsEditing(false);
                                    setAvatarFile(null);
                                    setFormData({
                                        preferred_name: profile.preferred_name || "",
                                        job_title: profile.job_title || "",
                                        location: profile.location || "",
                                        bio: profile.bio || "",
                                    });
                                }}
                                disabled={submitting}
                            >
                                Cancel
                            </button>
                            <button type="submit" className="ks-btn-primary" disabled={submitting}>
                                {submitting ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
