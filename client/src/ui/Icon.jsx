// <Icon name="basket" /> - inline Bootstrap Icons (no font download)
import icons from './icons';

export default function Icon({ name, className = '', size }) {
  const n = String(name || '').replace(/^bi-/, '');
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" width={size || '1em'} height={size || '1em'}
      className={'inline-block shrink-0 align-[-0.125em] ' + className} dangerouslySetInnerHTML={{ __html: icons[n] || '' }} />
  );
}
