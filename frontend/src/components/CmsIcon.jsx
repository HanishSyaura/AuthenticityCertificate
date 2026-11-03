import React from 'react';
import * as Lucide from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import * as FASolid from '@fortawesome/free-solid-svg-icons';
import * as FARegular from '@fortawesome/free-regular-svg-icons';
import * as FABrands from '@fortawesome/free-brands-svg-icons';

function toKebabCase(name) {
  return String(name)
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

function toLabel(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const lucideCatalog = Lucide.icons || {};

const LUCIDE_ICONS = Object.fromEntries(
  Object.entries(lucideCatalog).map(([name, component]) => [
    toKebabCase(name),
    component
  ])
);

// Keep names used by previously saved CMS content working.
const legacyLucideAliases = {
  certificate: 'badge-check',
  'globe-2': 'globe',
  boxes: 'boxes',
  'package-check': 'package-check'
};

for (const [alias, target] of Object.entries(legacyLucideAliases)) {
  if (!LUCIDE_ICONS[alias] && LUCIDE_ICONS[target]) {
    LUCIDE_ICONS[alias] = LUCIDE_ICONS[target];
  }
}

function collectFontAwesome(module, library, styleLabel) {
  return Object.entries(module)
    .filter(([exportName, definition]) =>
      /^fa[A-Z0-9]/.test(exportName) &&
      definition &&
      Array.isArray(definition.icon)
    )
    .map(([exportName, definition]) => {
      const rawName = exportName.slice(2);
      const value = toKebabCase(rawName);

      return {
        value,
        label: `${toLabel(rawName)} · ${styleLabel}`,
        library,
        category: styleLabel,
        searchText: `${value} ${rawName} ${toLabel(rawName)} ${styleLabel}`.toLowerCase(),
        faIcon: definition
      };
    });
}

const lucideOptions = Object.entries(lucideCatalog).map(([name]) => {
  const value = toKebabCase(name);
  const label = toLabel(name);

  return {
    value,
    label,
    library: 'lucide',
    category: 'Lucide',
    searchText: `${value} ${name} ${label}`.toLowerCase()
  };
});

const fontAwesomeOptions = [
  ...collectFontAwesome(FASolid, 'fontawesome-solid', 'Solid'),
  ...collectFontAwesome(FARegular, 'fontawesome-regular', 'Regular'),
  ...collectFontAwesome(FABrands, 'fontawesome-brands', 'Brands')
];

// Include compatibility aliases when a previous CMS value is not a
// canonical name in the current Lucide catalogue.
const knownLucideNames = new Set(lucideOptions.map((option) => option.value));

for (const [value, target] of Object.entries(legacyLucideAliases)) {
  if (!knownLucideNames.has(value) && LUCIDE_ICONS[target]) {
    lucideOptions.push({
      value,
      label: `${toLabel(value)} (legacy alias)`,
      library: 'lucide',
      category: 'Lucide',
      searchText: `${value} ${toLabel(value)} certificate globe website`.toLowerCase()
    });
  }
}

export const CMS_ICON_OPTIONS = [
  ...lucideOptions,
  ...fontAwesomeOptions
];

const FA_BY_LIBRARY = {
  'fontawesome-solid': Object.fromEntries(
    collectFontAwesome(FASolid, 'fontawesome-solid', 'Solid')
      .map((option) => [option.value, option.faIcon])
  ),
  'fontawesome-regular': Object.fromEntries(
    collectFontAwesome(FARegular, 'fontawesome-regular', 'Regular')
      .map((option) => [option.value, option.faIcon])
  ),
  'fontawesome-brands': Object.fromEntries(
    collectFontAwesome(FABrands, 'fontawesome-brands', 'Brands')
      .map((option) => [option.value, option.faIcon])
  )
};

// Compatibility for older content that stored iconLibrary="fontawesome".
const legacyFontAwesomeAliases = {
  star: FASolid.faStar,
  'shield-check': FASolid.faShieldHalved,
  shield: FASolid.faShieldHalved,
  heart: FASolid.faHeart,
  package: FASolid.faBox,
  box: FASolid.faBox,
  'circle-check': FASolid.faCircleCheck,
  check: FASolid.faCircleCheck,
  award: FASolid.faAward,
  leaf: FASolid.faLeaf,
  truck: FASolid.faTruck,
  certificate: FASolid.faCertificate,
  'badge-check': FASolid.faCertificate,
  'map-pin': FASolid.faLocationDot,
  phone: FASolid.faPhone,
  mail: FASolid.faEnvelope,
  globe: FASolid.faGlobe,
  facebook: FABrands.faFacebook,
  instagram: FABrands.faInstagram,
  linkedin: FABrands.faLinkedin,
  youtube: FABrands.faYoutube
};

export default function CmsIcon({ content = {} }) {
  const library = String(content.iconLibrary || 'lucide');
  const name = String(content.iconName || 'star');
  const color = String(content.iconColor || '#18181b');

  const sizeRaw = Number(content.iconSize);
  const size = Number.isFinite(sizeRaw)
    ? Math.max(8, Math.min(256, sizeRaw))
    : 40;

  const borderWidthRaw = Number(content.borderWidth);
  const borderWidth = Number.isFinite(borderWidthRaw)
    ? Math.max(0, Math.min(20, borderWidthRaw))
    : 0;

  const radiusRaw = Number(content.borderRadius);
  const radius = Number.isFinite(radiusRaw)
    ? Math.max(0, Math.min(100, radiusRaw))
    : 12;

  const backgroundEnabled = Boolean(content.backgroundEnabled);
  const Icon = LUCIDE_ICONS[name] || Lucide.Star;
  const faIcon = library === 'fontawesome'
    ? legacyFontAwesomeAliases[name]
    : FA_BY_LIBRARY[library]?.[name];

  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{
        boxSizing: 'border-box',
        backgroundColor: backgroundEnabled
          ? String(content.backgroundColor || '#ffffff')
          : 'transparent',
        borderColor: String(content.borderColor || '#e4e4e7'),
        borderWidth,
        borderStyle: borderWidth > 0 ? 'solid' : 'none',
        borderRadius: radius,
        overflow: 'hidden'
      }}
    >
      {faIcon ? (
        <FontAwesomeIcon
          icon={faIcon}
          aria-hidden="true"
          style={{
            color,
            width: size,
            height: size,
            maxWidth: '100%',
            maxHeight: '100%'
          }}
        />
      ) : (
        <Icon
          aria-hidden="true"
          color={color}
          size={size}
          strokeWidth={2}
          style={{ maxWidth: '100%', maxHeight: '100%' }}
        />
      )}
    </div>
  );
}
