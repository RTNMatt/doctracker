import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getTiles } from "../lib/api";
import type { Tile } from "../lib/types";
import TilesGrid from "../components/TilesGrid";

export default function HomeTilesPage() {
    const [tiles, setTiles] = useState<Tile[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [err, setErr] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        (async () => {
            try {
                const res = await getTiles();
                const safe = Array.isArray(res.data) ? res.data : (res.data.results ?? []);
                setTiles(safe);
            } catch (e: any) {
                setErr(e?.message ?? "Failed to load tiles.");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleTileClick = useCallback((t: Tile) => {
        switch (t.kind) {
            case "external":
                if (t.href) window.open(t.href, "_blank", "noopener, noreferrer");
                break;
            case "document":
                if (t.documentId != null) navigate(`/documents/${t.documentId}`);
                break;
            case "department":
                if (t.departmentSlug) navigate(`/departments/${t.departmentSlug}`);
                break;
            case "collection":
                if (t.collectionSlug) navigate(`/collections/${t.collectionSlug}`);
                break;
        }
    }, [navigate]);

    if (loading) {
        return <p>Loading tiles...</p>;
    }
    if (err) {
        return <p style={{ color: "red"}}>{err}</p>;
    }
    if (!tiles.length) {
        return <p>No tiles available.</p>;
    }

    return (
        <>
        <h1 className="home-title">DocTracker Home Page</h1>
        <TilesGrid tiles={tiles} onClickTile={handleTileClick} />
        </>
    );
}