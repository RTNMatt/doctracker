import type {Tile} from './Main';

type Props = { tiles: Tile[]};

export default function MainPageTiles({tiles }: Props) {
    return (
        <ul className="tiles">
            {tiles.map(t => (
                <li key={t.id} className="tile">
                    <a className="tile-link" href={t.url}>
                        {t.icon && <img className="tile-icon" src={t.icon} alt="" />}
                        <div className='"title-meta'>
                            <h2 className="tile-title">{t.title}</h2>
                            {t.description && <p className="tile-desc">{t.description}</p>}
                        </div>
                    </a>
                </li>
            ))}
        </ul>
    );
}