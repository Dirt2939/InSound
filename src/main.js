import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/views.css';
import { boot } from './app.js';

// O Spotify não aceita "localhost" como redirect — garantimos 127.0.0.1 em desenvolvimento.
if (location.hostname === 'localhost') {
  location.replace(location.href.replace('//localhost', '//127.0.0.1'));
} else {
  boot();
}
