"use client";

// Estimativa de unidade a partir de coordenadas do dispositivo, usada SÓ pelo botão "Usar minha
// localização" do UnitPickerModal (nunca automática). Sem integração externa de reverse
// geocoding (nenhum vendor novo, nenhum custo, nenhuma chamada de rede) - calcula localmente a
// distância em linha reta até o centro de Dourados e até o centro de Campo Grande e escolhe o
// mais próximo.
//
// LIMITAÇÃO CONHECIDA (documentar no relatório desta fase para aprovação/revisão do usuário): a
// regra de negócio oficial é "cidade de Dourados -> unidade Dourados; QUALQUER outra cidade de
// MS ou outro estado -> Campo Grande". Uma distância em linha reta não sabe se o dispositivo está
// de fato dentro do município de Dourados - um visitante de uma cidade vizinha (ex.: Itaporã,
// Fátima do Sul) pode estar geograficamente mais perto de Dourados sem estar na cidade, e seria
// estimado incorretamente como "Dourados" por esta função. Sem uma integração de geocodificação
// reversa por município (não aprovada nesta fase - ver relatório), esta é a melhor aproximação
// possível sem inventar um serviço externo. Por isso o resultado desta função é sempre oferecido
// como ESTIMATIVA dentro do modal (o usuário ainda confirma/pode trocar), nunca aplicado sem the
// usuário ver o resultado.
const CITY_COORDINATES = {
  dourados: { latitude: -22.2211, longitude: -54.8056 },
  "campo-grande": { latitude: -20.4697, longitude: -54.6201 },
};

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const distanceKm = (a, b) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const haversine =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
};

// Retorna "dourados" ou "campo-grande" - nunca null, já que Campo Grande é o fallback oficial
// para "qualquer outra região" mesmo quando a coordenada está fora de MS.
export const estimateUnitFromCoordinates = ({ latitude, longitude }) => {
  const point = { latitude, longitude };
  const distanceToDourados = distanceKm(point, CITY_COORDINATES.dourados);
  const distanceToCampoGrande = distanceKm(point, CITY_COORDINATES["campo-grande"]);

  return distanceToDourados < distanceToCampoGrande ? "dourados" : "campo-grande";
};
