import {
  calculateSimilarityPercent,
  computePerceptualHash,
  hammingDistance,
} from './hasher';
import {
  DuplicateGroup,
  PhotoItem,
  ScanStats,
} from './types';

/**
 * Format bytes to readable string (e.g., "14.2 MB", "1.4 GB").
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const index = Math.min(i, units.length - 1);
  const size = bytes / Math.pow(1024, index);
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

/**
 * High-quality procedural sample photos with data URIs for instant zero-setup demonstration.
 */
function createSvgDataUri(svg: string): string {
  const encoded = encodeURIComponent(svg.trim())
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml;utf8,${encoded}`;
}

export function getSampleDemoPhotos(): PhotoItem[] {
  const now = Date.now();

  // SVG 1: Cozy Coffee Cup (Exact Duplicate Pair)
  const coffeeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#451a03"/>
        <stop offset="100%" stop-color="#1e293b"/>
      </linearGradient>
      <radialGradient id="cup" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#fbbf24"/>
        <stop offset="100%" stop-color="#b45309"/>
      </radialGradient>
    </defs>
    <rect width="800" height="600" fill="url(#bg)"/>
    <circle cx="400" cy="300" r="140" fill="#f8fafc" opacity="0.95"/>
    <circle cx="400" cy="300" r="115" fill="url(#cup)"/>
    <ellipse cx="400" cy="290" rx="80" ry="30" fill="#78350f" opacity="0.6"/>
    <text x="400" y="520" fill="#f8fafc" font-size="28" font-family="sans-serif" font-weight="bold" text-anchor="middle">Sıcak Filtre Kahve • Sabah Çekimi</text>
  </svg>`;
  const coffeeUri = createSvgDataUri(coffeeSvg);

  // SVG 2: Mountain Sunset (Burst 1)
  const sunset1Svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <defs>
      <linearGradient id="sky1" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#f97316"/>
        <stop offset="60%" stop-color="#ec4899"/>
        <stop offset="100%" stop-color="#312e81"/>
      </linearGradient>
    </defs>
    <rect width="800" height="600" fill="url(#sky1)"/>
    <circle cx="400" cy="240" r="80" fill="#fef08a" opacity="0.9"/>
    <polygon points="100,600 350,320 600,600" fill="#1e1b4b"/>
    <polygon points="300,600 550,280 800,600" fill="#0f172a"/>
    <text x="400" y="550" fill="#ffffff" font-size="26" font-family="sans-serif" font-weight="bold" text-anchor="middle">Uludağ Gün Batımı • Seri Çekim 1</text>
  </svg>`;
  const sunset1Uri = createSvgDataUri(sunset1Svg);

  // SVG 3: Mountain Sunset (Burst 2 - slight bird & sun shift)
  const sunset2Svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <defs>
      <linearGradient id="sky2" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ea580c"/>
        <stop offset="60%" stop-color="#db2777"/>
        <stop offset="100%" stop-color="#1e1b4b"/>
      </linearGradient>
    </defs>
    <rect width="800" height="600" fill="url(#sky2)"/>
    <circle cx="405" cy="242" r="80" fill="#fef08a" opacity="0.95"/>
    <polygon points="100,600 350,320 600,600" fill="#1e1b4b"/>
    <polygon points="300,600 550,280 800,600" fill="#0f172a"/>
    <circle cx="280" cy="200" r="4" fill="#ffffff"/>
    <circle cx="295" cy="195" r="4" fill="#ffffff"/>
    <text x="400" y="550" fill="#ffffff" font-size="26" font-family="sans-serif" font-weight="bold" text-anchor="middle">Uludağ Gün Batımı • Seri Çekim 2</text>
  </svg>`;
  const sunset2Uri = createSvgDataUri(sunset2Svg);

  // SVG 4: Mountain Sunset (Burst 3 - slightly darker)
  const sunset3Svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <defs>
      <linearGradient id="sky3" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#c2410c"/>
        <stop offset="60%" stop-color="#be185d"/>
        <stop offset="100%" stop-color="#111827"/>
      </linearGradient>
    </defs>
    <rect width="800" height="600" fill="url(#sky3)"/>
    <circle cx="410" cy="245" r="80" fill="#fef08a" opacity="0.85"/>
    <polygon points="100,600 350,320 600,600" fill="#111827"/>
    <polygon points="300,600 550,280 800,600" fill="#030712"/>
    <text x="400" y="550" fill="#ffffff" font-size="26" font-family="sans-serif" font-weight="bold" text-anchor="middle">Uludağ Gün Batımı • Seri Çekim 3</text>
  </svg>`;
  const sunset3Uri = createSvgDataUri(sunset3Svg);

  // SVG 5: Mobile Screenshot 1 (Receipt / Invoice)
  const screenshot1Svg = `<svg xmlns="http://www.w3.org/2000/svg" width="450" height="800" viewBox="0 0 450 800">
    <rect width="450" height="800" fill="#0f172a"/>
    <rect x="30" y="60" width="390" height="680" rx="16" fill="#1e293b"/>
    <circle cx="225" cy="140" r="40" fill="#22c55e"/>
    <path d="M 210 140 L 220 150 L 245 130" stroke="#ffffff" stroke-width="6" fill="none" stroke-linecap="round"/>
    <text x="225" y="220" fill="#f8fafc" font-size="20" font-family="sans-serif" font-weight="bold" text-anchor="middle">Ödeme Başarılı</text>
    <text x="225" y="260" fill="#38bdf8" font-size="32" font-family="sans-serif" font-weight="bold" text-anchor="middle">₺1.450,00</text>
    <rect x="60" y="320" width="330" height="2" fill="#334155"/>
    <text x="70" y="370" fill="#94a3b8" font-size="16" font-family="sans-serif">Tarih: 09.08.2026</text>
    <text x="70" y="410" fill="#94a3b8" font-size="16" font-family="sans-serif">Dekont No: #8492048</text>
    <text x="225" y="710" fill="#64748b" font-size="14" font-family="sans-serif" text-anchor="middle">Ekran Görüntüsü #1</text>
  </svg>`;
  const screenshot1Uri = createSvgDataUri(screenshot1Svg);

  // SVG 6: Mobile Screenshot 2 (Map Location)
  const screenshot2Svg = `<svg xmlns="http://www.w3.org/2000/svg" width="450" height="800" viewBox="0 0 450 800">
    <rect width="450" height="800" fill="#1e293b"/>
    <path d="M 50 150 L 400 200 L 350 650 L 80 580 Z" fill="#334155" opacity="0.6"/>
    <path d="M 0 350 Q 200 300 450 420" stroke="#38bdf8" stroke-width="12" fill="none"/>
    <circle cx="225" cy="380" r="25" fill="#ef4444"/>
    <circle cx="225" cy="380" r="10" fill="#ffffff"/>
    <text x="225" y="480" fill="#f8fafc" font-size="22" font-family="sans-serif" font-weight="bold" text-anchor="middle">Buluşma Noktası</text>
    <text x="225" y="710" fill="#64748b" font-size="14" font-family="sans-serif" text-anchor="middle">Ekran Görüntüsü #2</text>
  </svg>`;
  const screenshot2Uri = createSvgDataUri(screenshot2Svg);

  // SVG 7: High-Res 4K Drone Coastline (Large File > 5MB)
  const largeDrone1Svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
    <defs>
      <linearGradient id="sea" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0284c7"/>
        <stop offset="50%" stop-color="#0d9488"/>
        <stop offset="100%" stop-color="#f59e0b"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="900" fill="url(#sea)"/>
    <path d="M 0 400 Q 600 300 1200 550 L 1200 900 L 0 900 Z" fill="#d97706" opacity="0.8"/>
    <text x="600" y="250" fill="#ffffff" font-size="44" font-family="sans-serif" font-weight="bold" text-anchor="middle">4K RAW Drone Çekimi • Ege Kıyıları</text>
    <text x="600" y="320" fill="#ffffff" font-size="24" font-family="sans-serif" opacity="0.9" text-anchor="middle">3840 × 2160 Ultra HD • 8.4 MB</text>
  </svg>`;
  const largeDrone1Uri = createSvgDataUri(largeDrone1Svg);

  // SVG 8: High-Res 4K Drone Forest (Large File > 5MB)
  const largeDrone2Svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
    <defs>
      <linearGradient id="forest" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#14532d"/>
        <stop offset="70%" stop-color="#166534"/>
        <stop offset="100%" stop-color="#052e16"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="900" fill="url(#forest)"/>
    <circle cx="600" cy="450" r="280" fill="#15803d" opacity="0.7"/>
    <text x="600" y="420" fill="#f0fdf4" font-size="44" font-family="sans-serif" font-weight="bold" text-anchor="middle">4K RAW Drone • Karadeniz Yaylaları</text>
    <text x="600" y="490" fill="#dcfce7" font-size="24" font-family="sans-serif" opacity="0.9" text-anchor="middle">4096 × 2160 DCI • 9.8 MB</text>
  </svg>`;
  const largeDrone2Uri = createSvgDataUri(largeDrone2Svg);

  return [
    // Exact Duplicates (Coffee)
    {
      id: 'demo_coffee_1',
      uri: coffeeUri,
      name: 'IMG_20260809_083421.jpg',
      size: 4.2 * 1024 * 1024,
      width: 4032,
      height: 3024,
      createdAt: now - 3600000 * 2,
      ahash: 'ff818181818181ff',
      dhash: '0000183c3c180000',
    },
    {
      id: 'demo_coffee_copy',
      uri: coffeeUri,
      name: 'IMG_20260809_083421_Kopya.jpg',
      size: 4.2 * 1024 * 1024,
      width: 4032,
      height: 3024,
      createdAt: now - 3600000 * 2 + 1000,
      ahash: 'ff818181818181ff',
      dhash: '0000183c3c180000',
    },

    // Similar Bursts (Sunset)
    {
      id: 'demo_sunset_burst_1',
      uri: sunset1Uri,
      name: 'BURST_20260809_194512_01.jpg',
      size: 5.1 * 1024 * 1024,
      width: 4032,
      height: 3024,
      createdAt: now - 86400000,
      ahash: 'ffff81818181ffff',
      dhash: '0f1e3c78f0e0c080',
    },
    {
      id: 'demo_sunset_burst_2',
      uri: sunset2Uri,
      name: 'BURST_20260809_194512_02.jpg',
      size: 4.9 * 1024 * 1024,
      width: 3840,
      height: 2880,
      createdAt: now - 86400000 + 400,
      ahash: 'ffff81818183ffff',
      dhash: '0f1e3c78f0e0c082',
    },
    {
      id: 'demo_sunset_burst_3',
      uri: sunset3Uri,
      name: 'BURST_20260809_194512_03.jpg',
      size: 4.6 * 1024 * 1024,
      width: 3000,
      height: 2250,
      createdAt: now - 86400000 + 800,
      ahash: 'ffff81818187ffff',
      dhash: '0f1e3c78f0e0c086',
    },

    // Screenshots
    {
      id: 'demo_ss_1',
      uri: screenshot1Uri,
      name: 'Screenshot_20260809_141205.png',
      size: 1.8 * 1024 * 1024,
      width: 1170,
      height: 2532,
      createdAt: now - 7200000,
      isScreenshot: true,
      ahash: 'e7c381000081c3e7',
      dhash: '1234567890abcdef',
    },
    {
      id: 'demo_ss_2',
      uri: screenshot2Uri,
      name: 'Ekran_Goruntusu_Harita.png',
      size: 2.1 * 1024 * 1024,
      width: 1170,
      height: 2532,
      createdAt: now - 14400000,
      isScreenshot: true,
      ahash: '7ec381000081c37e',
      dhash: 'fedcba0987654321',
    },

    // Large files > 5MB
    {
      id: 'demo_large_1',
      uri: largeDrone1Uri,
      name: 'DJI_0492_Ege_Sahil_4K.jpg',
      size: 8.4 * 1024 * 1024,
      width: 3840,
      height: 2160,
      createdAt: now - 172800000,
      isLarge: true,
      ahash: 'ff00ff00ff00ff00',
      dhash: 'aa55aa55aa55aa55',
    },
    {
      id: 'demo_large_2',
      uri: largeDrone2Uri,
      name: 'DJI_0518_Yayla_Forest_4K.jpg',
      size: 9.8 * 1024 * 1024,
      width: 4096,
      height: 2160,
      createdAt: now - 172800000 + 5000,
      isLarge: true,
      ahash: '00ff00ff00ff00ff',
      dhash: '55aa55aa55aa55aa',
    },
  ];
}

/**
 * Scans photo list and builds grouped duplicates, similar bursts, screenshots, and large files.
 */
export async function scanAndGroupPhotos(
  photos: PhotoItem[]
): Promise<{ groups: DuplicateGroup[]; stats: ScanStats }> {
  // Ensure hashes are computed
  const processedPhotos: PhotoItem[] = [];
  for (const photo of photos) {
    let ahash = photo.ahash;
    let dhash = photo.dhash;

    if (!ahash || !dhash) {
      const hashResult = await computePerceptualHash(photo.uri, photo.width, photo.height);
      ahash = hashResult.ahash;
      dhash = hashResult.dhash;
    }

    const isScreenshot =
      photo.isScreenshot ??
      (photo.name.toLowerCase().includes('screenshot') ||
        photo.name.toLowerCase().includes('ekran') ||
        (photo.height > 0 && photo.width > 0 && photo.height / photo.width > 2.0));

    const isLarge = photo.isLarge ?? photo.size > 5 * 1024 * 1024;

    processedPhotos.push({
      ...photo,
      ahash,
      dhash,
      isScreenshot,
      isLarge,
      selectedForDelete: false,
    });
  }

  const groups: DuplicateGroup[] = [];
  const assignedPhotoIds = new Set<string>();

  // 1. Group Exact Duplicates (Hamming distance == 0)
  for (let i = 0; i < processedPhotos.length; i++) {
    const p1 = processedPhotos[i];
    if (assignedPhotoIds.has(p1.id)) continue;

    const cluster: PhotoItem[] = [p1];
    for (let j = i + 1; j < processedPhotos.length; j++) {
      const p2 = processedPhotos[j];
      if (assignedPhotoIds.has(p2.id)) continue;

      const distA = hammingDistance(p1.ahash || '', p2.ahash || '');
      const distD = hammingDistance(p1.dhash || '', p2.dhash || '');

      if (distA === 0 && distD === 0) {
        cluster.push(p2);
        assignedPhotoIds.add(p2.id);
      }
    }

    if (cluster.length > 1) {
      assignedPhotoIds.add(p1.id);
      const totalSize = cluster.reduce((sum, p) => sum + p.size, 0);
      const best = findBestPhoto(cluster);
      const recoverable = totalSize - best.size;

      groups.push({
        id: `exact_group_${i}`,
        type: 'exact',
        title: 'Birebir Kopya Fotoğraflar',
        subtitle: `${cluster.length} Adet Özdeş Görsel (%100 Eşleşme)`,
        similarityPercent: 100,
        photos: cluster,
        bestPhotoId: best.id,
        recoverableBytes: recoverable,
      });
    }
  }

  // 2. Group Similar Burst Photos (Hamming distance 1 to 8, similarity >= 85%)
  for (let i = 0; i < processedPhotos.length; i++) {
    const p1 = processedPhotos[i];
    if (assignedPhotoIds.has(p1.id) || p1.isScreenshot) continue;

    const cluster: PhotoItem[] = [p1];
    let minSim = 100;

    for (let j = i + 1; j < processedPhotos.length; j++) {
      const p2 = processedPhotos[j];
      if (assignedPhotoIds.has(p2.id) || p2.isScreenshot) continue;

      const distA = hammingDistance(p1.ahash || '', p2.ahash || '');
      const distD = hammingDistance(p1.dhash || '', p2.dhash || '');
      const avgDist = (distA + distD) / 2;

      if (avgDist > 0 && avgDist <= 8) {
        const sim = calculateSimilarityPercent(p1.ahash || '', p2.ahash || '');
        minSim = Math.min(minSim, sim);
        cluster.push(p2);
        assignedPhotoIds.add(p2.id);
      }
    }

    if (cluster.length > 1) {
      assignedPhotoIds.add(p1.id);
      const totalSize = cluster.reduce((sum, p) => sum + p.size, 0);
      const best = findBestPhoto(cluster);
      const recoverable = totalSize - best.size;

      groups.push({
        id: `similar_group_${i}`,
        type: 'similar',
        title: 'Benzer Seri Çekimler (Burst)',
        subtitle: `${cluster.length} Adet Benzer Açı / Çekim (~%${minSim})`,
        similarityPercent: minSim,
        photos: cluster,
        bestPhotoId: best.id,
        recoverableBytes: recoverable,
      });
    }
  }

  // 3. Group Screenshots
  const screenshots = processedPhotos.filter(
    (p) => p.isScreenshot && !assignedPhotoIds.has(p.id)
  );
  if (screenshots.length > 0) {
    const recoverable = screenshots.reduce((sum, p) => sum + p.size, 0);
    groups.push({
      id: 'screenshots_group',
      type: 'screenshot',
      title: 'Ekran Görüntüleri',
      subtitle: `${screenshots.length} Adet Gereksiz / Eski Ekran Alıntısı`,
      similarityPercent: 0,
      photos: screenshots,
      recoverableBytes: recoverable,
    });
  }

  // 4. Group Large Media Files (> 5MB)
  const largeFiles = processedPhotos.filter(
    (p) => p.isLarge && !assignedPhotoIds.has(p.id) && !p.isScreenshot
  );
  if (largeFiles.length > 0) {
    const recoverable = largeFiles.reduce((sum, p) => sum + p.size, 0);
    groups.push({
      id: 'large_files_group',
      type: 'large',
      title: 'Büyük Boyutlu Medyalar (>5 MB)',
      subtitle: `${largeFiles.length} Adet Yüksek Çözünürlüklü Dosya`,
      similarityPercent: 0,
      photos: largeFiles,
      recoverableBytes: recoverable,
    });
  }

  // Calculate statistics
  const stats = calculateStats(processedPhotos.length, groups);

  return { groups, stats };
}

/**
 * Determines the single best photo in a cluster:
 * 1. Highest resolution (pixels)
 * 2. Largest file size (least compressed)
 * 3. Earliest creation time
 */
export function findBestPhoto(photos: PhotoItem[]): PhotoItem {
  return [...photos].sort((a, b) => {
    const resA = (a.width || 0) * (a.height || 0);
    const resB = (b.width || 0) * (b.height || 0);
    if (resB !== resA) return resB - resA;
    if (b.size !== a.size) return b.size - a.size;
    return (a.createdAt || 0) - (b.createdAt || 0);
  })[0];
}

/**
 * Smart 'En İyisini Koru' action:
 * Keeps the best photo preserved, marks all copies for deletion.
 */
export function applySmartKeepBest(groups: DuplicateGroup[]): DuplicateGroup[] {
  return groups.map((group) => {
    if (group.type === 'exact' || group.type === 'similar') {
      const best = findBestPhoto(group.photos);
      const updatedPhotos = group.photos.map((p) => ({
        ...p,
        isBest: p.id === best.id,
        selectedForDelete: p.id !== best.id,
      }));

      return {
        ...group,
        bestPhotoId: best.id,
        photos: updatedPhotos,
      };
    } else if (group.type === 'screenshot') {
      // For screenshots, default select all for cleanup
      return {
        ...group,
        photos: group.photos.map((p) => ({
          ...p,
          selectedForDelete: true,
        })),
      };
    }
    return group;
  });
}

/**
 * Recalculates stats from current groups and selected states.
 */
export function calculateStats(totalScanned: number, groups: DuplicateGroup[]): ScanStats {
  let totalDuplicatesFound = 0;
  let totalSimilarFound = 0;
  let totalScreenshotsFound = 0;
  let totalLargeFound = 0;
  let totalRecoverableBytes = 0;
  let selectedRecoverableBytes = 0;
  let selectedCount = 0;

  for (const group of groups) {
    totalRecoverableBytes += group.recoverableBytes;

    if (group.type === 'exact') {
      totalDuplicatesFound += group.photos.length;
    } else if (group.type === 'similar') {
      totalSimilarFound += group.photos.length;
    } else if (group.type === 'screenshot') {
      totalScreenshotsFound += group.photos.length;
    } else if (group.type === 'large') {
      totalLargeFound += group.photos.length;
    }

    for (const photo of group.photos) {
      if (photo.selectedForDelete) {
        selectedCount++;
        selectedRecoverableBytes += photo.size;
      }
    }
  }

  return {
    totalScanned,
    totalDuplicatesFound,
    totalSimilarFound,
    totalScreenshotsFound,
    totalLargeFound,
    totalRecoverableBytes,
    selectedRecoverableBytes,
    selectedCount,
  };
}
