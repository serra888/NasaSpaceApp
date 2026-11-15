const copy = {
  en: {
    hydration: ["Hydration check", "Drink water according to your normal onboard hydration plan.", 3],
    movement: ["Gentle mobility", "Complete a comfortable, approved stretch break and stop if discomfort increases.", 5],
    focus: ["One clear priority", "Choose one small priority for the next work block and remove one distraction.", 4],
    connection: ["Crew connection", "Share a brief check-in or a positive observation with a crewmate.", 5],
    recovery: ["Quiet reset", "Take a slow screen-free pause in a comfortable position and notice your breathing.", 5],
    status: (name) => `${name}, today's plan keeps things short, safe, and achievable.`
  },
  tr: {
    hydration: ["Su molası", "Normal kabin içi sıvı planına uygun şekilde su iç.", 3],
    movement: ["Hafif hareket", "Rahat ve onaylı bir esneme molası yap; rahatsızlık artarsa dur.", 5],
    focus: ["Tek net öncelik", "Sonraki çalışma bölümü için küçük bir öncelik seç ve bir dikkat dağıtıcıyı kaldır.", 4],
    connection: ["Ekip bağlantısı", "Bir ekip arkadaşıyla kısa bir durum paylaşımı veya olumlu bir gözlem yap.", 5],
    recovery: ["Sessiz yenilenme", "Rahat bir pozisyonda ekransız, yavaş bir mola ver ve nefesini fark et.", 5],
    status: (name) => `${name}, bugünkü plan kısa, güvenli ve ulaşılabilir adımlardan oluşuyor.`
  }
};

function mission(category, language) {
  const [title, description, durationMinutes] = copy[language][category];
  return { title, description, durationMinutes, category };
}

export function createFallbackContent(snapshot) {
  const language = snapshot.locale.toLowerCase().startsWith("tr") ? "tr" : "en";
  const gentleDay = snapshot.energyLevel <= 2 || snapshot.hasDiscomfort || snapshot.mood === "tired";
  const elevatedStress = snapshot.stressLevel >= 4 || snapshot.mood === "stressed";
  const categories = gentleDay
    ? ["hydration", "recovery", "connection"]
    : elevatedStress
      ? ["recovery", "focus", "connection"]
      : ["hydration", "movement", "focus"];

  return {
    missions: categories.map((category) => mission(category, language)),
    statusMessage: copy[language].status(snapshot.displayName)
  };
}
