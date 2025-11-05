import type { Tile } from "../lib/types";
import TileCard from "./TileCard";
import './TilesGrid.css'

export default function TilesGrid({
    tiles,
    onClickTile,
}: {
    tiles: Tile[];
    onClickTile: (t: Tile) => void;
}) {
    return (
        <ul className="tiles">
            {tiles.map((t) => (
                <li key={t.id} className="tile">
                    <TileCard tile={t} onClick={() => onClickTile(t)} />
                </li>
            ))}
        </ul>
    );
}