
import './Header.css';


export default function Header() {
    return (
        <header className="site-header">
            <nav className="nav">
                <a className="brand" href="/">DocTracker</a>
                <ul className='nav-links'>
                    <li><a href="/">Hold Link 1</a></li>
                    <li><a href="/">Hold Link 2</a></li>
                    <li><a href="/">Hold Link 3</a></li>
                </ul>
                <button className="cta">SignIn</button>
            </nav>
        </header>
    );
}

