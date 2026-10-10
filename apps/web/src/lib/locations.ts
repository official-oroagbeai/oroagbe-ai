export interface OsunLocation {
  id: string;
  nameEn: string;
  nameYo: string;
}

export const OSUN_LOCATIONS: OsunLocation[] = [
  { id: 'osogbo', nameEn: 'Osogbo (Capital)', nameYo: 'Òṣogbo' },
  { id: 'ile-ife', nameEn: 'Ile-Ife (Osun East)', nameYo: 'Ilé-Ifẹ̀' },
  { id: 'ilesa', nameEn: 'Ilesa (Osun East)', nameYo: 'Iléṣà' },
  { id: 'ede', nameEn: 'Ede (Osun West)', nameYo: 'Ẹdẹ' },
  { id: 'ikirun', nameEn: 'Ikirun (Osun Central)', nameYo: 'Ìkìrun' },
  { id: 'iwo', nameEn: 'Iwo (West)', nameYo: 'Ìwó' },
  { id: 'ejigbo', nameEn: 'Ejigbo', nameYo: 'Ẹlẹ́jìgbò' },
  { id: 'ila-orangun', nameEn: 'Ila Orangun', nameYo: 'Ìlá Ọ̀ràngún' }
];