// eNamad (Iranian e-commerce trust seal) verification badge.
// The href/src/code values are the site's registered eNamad id and must not
// be altered — they're what the seal's own verification popup checks against.
export default function EnamadBadge() {
  return (
    <div className="flex justify-center mb-4">
      <a
        referrerPolicy="origin"
        target="_blank"
        rel="noopener noreferrer"
        href="https://trustseal.enamad.ir/?id=6772917&Code=1W2GHhLorUzP1exQg8fQhVrNYgVZEUCf"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          referrerPolicy="origin"
          src="https://trustseal.enamad.ir/logo.aspx?id=6772917&Code=1W2GHhLorUzP1exQg8fQhVrNYgVZEUCf"
          alt="نماد اعتماد الکترونیکی"
          style={{ cursor: "pointer" }}
        />
      </a>
    </div>
  );
}
