// src/pages/UserProfilePage.tsx
import { useEffect, useState, useRef, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getProfile, updateProfile, listUserDocuments, listUserCollections } from "../lib/api";
import type { Tile } from "../lib/types";
import TileCard from "../components/TileCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./UserProfilePage.css";

type ProfileData = {
    user: { id: number; username: string };
    preferred_first_name: string;
    preferred_last_name: string;
    job_title: string;
    location: string;
    bio: string;
    avatar_url: string | null;
    departments: Array<{ id: number; name: string; slug: string }>;
};

// Helper for horizontal scroll sections
function HorizontalSection({ title, tiles, onTileClick }: { title: string, tiles: Tile[], onTileClick: (t: Tile) => void }) {
    const scrollRef = useRef<HTMLDivElement>(null);

    const scroll = (dir: "left" | "right") => {
        if (scrollRef.current) {
            const amount = 300;
            scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
        }
    };

    return (
        <div className="content-section">
            <h3>{title}</h3>
            {tiles.length === 0 ? (
                <div className="empty-list-placeholder">
                    <p>No items yet.</p>
                </div>
            ) : (
                <div className="horizontal-list-wrap">
                    <button className="scroll-btn left" onClick={() => scroll("left")} aria-label="Scroll left">
                        <ChevronLeft size={20} />
                    </button>
                    <div className="horizontal-list" ref={scrollRef}>
                        {tiles.map(tile => (
                            <div key={tile.id} className="tile-wrapper" style={{ flex: "0 0 280px" }}>
                                <TileCard tile={tile} onClick={() => onTileClick(tile)} />
                            </div>
                        ))}
                    </div>
                    <button className="scroll-btn right" onClick={() => scroll("right")} aria-label="Scroll right">
                        <ChevronRight size={20} />
                    </button>
                </div>
            )}
        </div>
    );
}

export default function UserProfilePage() {
    const { userId } = useParams();
    const { user: authUser } = useAuth();
    const navigate = useNavigate();

    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [collections, setCollections] = useState<Tile[]>([]);
    const [documents, setDocuments] = useState<Tile[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        preferred_first_name: "",
        preferred_last_name: "",
        job_title: "",
        location: "",
        bio: "",
    });
    const [avatarFile, setAvatarFile] = useState<File | null>(null);

    const isOwnProfile = !userId || (authUser && Number(userId) === authUser.id);

    useEffect(() => {
        loadData();
    }, [userId]);

    async function loadData() {
        setLoading(true);
        setError(null);
        try {
            const id = userId ? parseInt(userId, 10) : undefined;
            const profileData = await getProfile(id);
            setProfile(profileData);
            setFormData({
                preferred_first_name: profileData.preferred_first_name || "",
                preferred_last_name: profileData.preferred_last_name || "",
                job_title: profileData.job_title || "",
                location: profileData.location || "",
                bio: profileData.bio || "",
            });

            // Fetch content
            const targetUserId = profileData.user.id;
            const [docs, cols] = await Promise.all([
                listUserDocuments(targetUserId),
                listUserCollections(targetUserId)
            ]);

            // Convert to Tile format for display
            setDocuments(docs.map((d: any) => ({
                id: d.id,
                title: d.title,
                kind: "document",
                documentId: d.id,
                description: "Document",
            })));

            setCollections(cols.map((c: any) => ({
                id: c.id,
                title: c.name,
                kind: "collection",
                collectionSlug: c.slug,
                description: c.description,
            })));

        } catch (err: any) {
            console.error("Failed to load profile data", err);
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
            data.append("preferred_first_name", formData.preferred_first_name);
            data.append("preferred_last_name", formData.preferred_last_name);
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

    const handleTileClick = (t: Tile) => {
        if (t.kind === "document" && t.documentId) navigate(`/documents/${t.documentId}`);
        if (t.kind === "collection" && t.collectionSlug) navigate(`/collections/${t.collectionSlug}`);
    };

    if (loading) return <div className="page-wrapper"><p>Loading profile...</p></div>;
    if (error || !profile) return <div className="page-wrapper"><p className="error">{error || "Profile not found"}</p></div>;

    const displayName = [profile.preferred_first_name, profile.preferred_last_name].filter(Boolean).join(" ") || profile.user.username;

    return (
        <div className="user-profile-page">
            <div className="profile-top-row">
                {/* Left Column: Profile Card */}
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
                                <label>First Name</label>
                                <input
                                    type="text"
                                    value={formData.preferred_first_name}
                                    onChange={e => setFormData({ ...formData, preferred_first_name: e.target.value })}
                                    placeholder="e.g. Jane"
                                />
                            </div>

                            <div className="form-row">
                                <label>Last Name</label>
                                <input
                                    type="text"
                                    value={formData.preferred_last_name}
                                    onChange={e => setFormData({ ...formData, preferred_last_name: e.target.value })}
                                    placeholder="e.g. Doe"
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
                                            preferred_first_name: profile.preferred_first_name || "",
                                            preferred_last_name: profile.preferred_last_name || "",
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

                {/* Right Column: Content */}
                <div className="profile-lists-column">
                    <HorizontalSection title="My Collections" tiles={collections} onTileClick={handleTileClick} />
                    <HorizontalSection title="My Documents" tiles={documents} onTileClick={handleTileClick} />
                </div>
            </div>

            {/* Bottom Row: Personal Space */}
            <div className="personal-space-tile">
                <p>Personalize this space with images, notes, or links (Coming Soon)</p>
            </div>
        </div>
    );
}
