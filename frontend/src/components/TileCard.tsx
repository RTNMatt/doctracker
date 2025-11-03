import type { Tile } from "../lib/types";

export default function TileCard({
    tile,
    onClick,
}: {
    tile: Tile;
    onClick: () => void;
}) {
    const badge =
    tile.kind === "external" ? "↗" :
    tile.kind === "document" ? "📄" :
    tile.kind === "department" ? "🗂️" :
    tile.kind === "collection" ? "🏷️" : "";

    return (
        <button className="tile-link" onClick={onClick}>
            {tile.icon && <img className="tile-icon" src={tile.icon} alt="" />}
            <div className="title-meta">
                <h2 className="tile-title">{badge} {tile.title}</h2>
                {tile.description && <p className="tile-desc">{tile.description}</p>}
            </div>
        </button>
    );
}