/**
 * Profil colorimétrique sRGB v2 embarqué dans le PDF Factur-X.
 *
 * PDF/A impose une intention de sortie (`OutputIntent`) accompagnée du profil ICC lui-même : sans
 * lui, un lecteur ne peut pas garantir que les couleurs du document seront restituées à
 * l'identique dans dix ans, ce qui est tout l'objet de la norme d'archivage.
 *
 * Profil « sRGB-v2-micro » du projet Compact-ICC-Profiles (licence CC0, domaine public) :
 * 456 octets contre 3 à 60 Ko pour les profils habituels, pour un résultat colorimétrique
 * identique. Il est écrit ici en base64 plutôt que déposé en fichier pour qu'aucune histoire de
 * chemin ou de bundle serveur ne puisse le faire disparaître d'un déploiement.
 */
export const ICC_SRGB_BASE64 =
  "AAAByGxjbXMCEAAAbW50clJHQiBYWVogB+IAAwAUAAkADgAdYWNzcE1TRlQAAAAAc2F3c2N0cmwAAAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1oYW5knZEAPUCAsD1AdCyBnqUijgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJZGVzYwAAAPAAAABfY3BydAAAAQwAAAAMd3RwdAAAARgAAAAUclhZWgAAASwAAAAUZ1hZWgAAAUAAAAAUYlhZWgAAAVQAAAAUclRSQwAAAWgAAABgZ1RSQwAAAWgAAABgYlRSQwAAAWgAAABgZGVzYwAAAAAAAAAFdVJHQgAAAAAAAAAAAAAAAHRleHQAAAAAQ0MwAFhZWiAAAAAAAADzVAABAAAAARbJWFlaIAAAAAAAAG+gAAA48gAAA49YWVogAAAAAAAAYpYAALeJAAAY2lhZWiAAAAAAAAAkoAAAD4UAALbEY3VydgAAAAAAAAAqAAAAfAD4AZwCdQODBMkGTggSChgMYg70Ec8U9hhqHC4gQySsKWoufjPrObM/1kZXTTZUdlwXZB1shnVWfo2ILJI2nKunjLLbvpnKx9dl5Hfx+f//";
