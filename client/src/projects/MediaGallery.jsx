// Demo-first hero: the demo video first, then screenshots / build photos.
// Swipe on a phone, arrows + dots on desktop, tap a picture to zoom.
import { useEffect, useRef, useState } from 'react';
import { Thumb, videoEmbed } from '../components/ui.jsx';

export default function MediaGallery({ project }) {
  const track = useRef(null);
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(null);

  useEffect(() => {
    if (!zoom) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setZoom(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  const embed = videoEmbed(project.videoUrl);
  const slides = [
    ...(embed ? [{ kind: 'video', src: embed }] : []),
    ...(project.screenshots || []).map((src) => ({ kind: 'image', src })),
  ];
  if (!slides.length && project.thumbnail) slides.push({ kind: 'image', src: project.thumbnail });
  if (!slides.length) return <Thumb project={project} className="hero-thumb" />;

  const noun = project.category === 'hardware' ? 'photo' : 'screenshot';
  const onScroll = () => {
    const el = track.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };
  const go = (i) => {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="gallery" id="demo">
      <div className="gallery-track" ref={track} onScroll={onScroll} aria-roledescription="carousel" aria-label="Demo video and pictures">
        {slides.map((s, i) => (
          <div className="gallery-slide" key={s.src} aria-label={`${i + 1} of ${slides.length}`}>
            {s.kind === 'video' ? (
              <iframe src={s.src} title={`${project.title} demo video`} loading="lazy" allowFullScreen
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" />
            ) : (
              <button type="button" className="gallery-img" onClick={() => setZoom(s.src)} aria-label={`Zoom ${noun} ${i + 1}`}>
                <img src={s.src} alt={`${project.title} ${noun} ${i + 1}`} loading={i ? 'lazy' : 'eager'} />
              </button>
            )}
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="gallery-bar">
          <button type="button" className="gallery-arrow" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous">‹</button>
          <div className="gallery-dots">
            {slides.map((s, i) => (
              <button type="button" key={s.src} className={i === index ? 'dot on' : 'dot'} onClick={() => go(i)}
                aria-label={s.kind === 'video' ? 'Show video' : `Show ${noun} ${i + 1}`} aria-current={i === index} />
            ))}
          </div>
          <span className="muted small">{index + 1}/{slides.length}</span>
          <button type="button" className="gallery-arrow" onClick={() => go(index + 1)} disabled={index === slides.length - 1} aria-label="Next">›</button>
        </div>
      )}
      {zoom && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Picture" onClick={() => setZoom(null)}>
          <img src={zoom} alt="" />
          <button type="button" className="lightbox-close" aria-label="Close">✕</button>
        </div>
      )}
    </div>
  );
}
