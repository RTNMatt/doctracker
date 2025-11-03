import './Sidebar.css';


export default function Sidebar() {
    return (
        <aside className="site-sidebar">
            <div className="sidebar-inner">
                <h3>Sections</h3>
                <ul>
                    <li><a href="/">Hold 1</a></li>
                    <li><a href="/">Hold 2</a></li>
                    <li><a href="/">Hold 3</a></li>
                </ul>

                <h3>Related</h3>
                <ul>
                    <li><a href="/">Related 1</a></li>
                    <li><a href="/">Related 2</a></li>
                    <li><a href="/">Related 3</a></li>
                </ul>
            </div>
        </aside>
    );
}