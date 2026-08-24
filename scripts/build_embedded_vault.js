// scripts/build_embedded_vault.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const RAW_ENIGMAS = [
  [90,"TERRE","LUNE","ORBITER","Mouvement perpétuel autour d'un astre",1,"verbe","TOURNER","GRAVITER"],
  [91,"SOLEIL","TERRE","CHAUFFER","Action thermique du rayonnement stellaire",1,"verbe","RAYONNER","ÉCLAIRER"],
  [92,"ETOILE","NUIT","SCINTILLER","Effet lumineux des astres dans le ciel sombre",2,"verbe","BRILLER","MIROITER"],
  [93,"EAU","GLACE","GELER","Passage de l'état liquide au solide par le froid",2,"verbe","SOLIDIFIER","REFROIDIR"],
  [94,"FUSEE","CIEL","DECOLLER","Quitter le sol pour s'élancer vers l'espace",2,"verbe","PROPULSER","MONTER"],
  [95,"AIMANT","FER","ATTIRER","Force magnétique invisible à l'œuvre",3,"verbe","COLLER","CAPTURER"],
  [96,"PLUIE","NUAGE","PLEUVOIR","Précipitations issues de la condensation",3,"verbe","TOMBER","CUMULER"],
  [97,"PLANTE","SOLEIL","POUSSER","Développement végétal grâce à la lumière",3,"verbe","GRANDIR","VERDIR"],
  [98,"VOLCAN","LAVE","EXPLOSER","Libération violente de matière en fusion",4,"verbe","ERUPTER","CRACHER"],
  [99,"GRAVITE","POMME","TOMBER","Chute verticale provoquée par l'attraction universelle",4,"verbe","PLONGER","GLISSER"],
  [100,"THERMOMETRE","FEU","MONTER","Élévation de la colonne sous l'effet de la chaleur",5,"verbe","DILATER","HAUSSER"],
  [101,"ATOMES","LIEN","ASSEMBLER","Union chimique pour former une molécule",5,"verbe","LIER","COMBINER"],
  [102,"STATION","ESPACE","FLOTTER","Absence de poids ressentie par les astronautes",6,"verbe","LÉVITER","PLANER"],
  [103,"METEORITE","ATMOSPHERE","CONSUMER","Destruction par le frottement de l'air à grande vitesse",6,"verbe","CALCINER","EMBRASSER"],
  [104,"OXYGENE","FEU","ALIMENTER","Carburant gazeux indispensable à la combustion",7,"verbe","ENTRETENIR","PROPAGER"],
  [105,"ECLIPSE","LUNE","CACHER","Masquage temporaire d'un astre par un autre",7,"verbe","VOILER","OBSCURCIR"],
  [106,"RADAR","ONDE","DETECTER","Repérage d'objets lointains par écho radio",8,"verbe","LOCALISER","SCANNER"],
  [107,"FOSSILE","ROCHE","CONSERVER","Préservation millénaire d'une empreinte du passé",8,"verbe","FIGER","MUMIFIER"],
  [108,"PRISME","LUMIERE","DIVISER","Séparation des couleurs composant un rayon",9,"verbe","RAYONNER","DISPERSER"],
  [109,"SEISME","SOL","TREMBLER","Secousse tellurique ressentie à la surface",9,"verbe","VIBRER","OSCILLER"],
  [110,"SONDE","MARS","EXPLORER","Mission scientifique de découverte planétaire",10,"verbe","SURVOLER","ANALYSER"],
  [111,"CARBONE","PRESSION","DIAMANT","Transformation géologique extrême menant au joyau",1,"nom","CRISTAL","MINÉRAL"],
  [112,"EAU","TEMPERATURE","VAPEUR","État gazeux atteint au point d'ébullition",2,"nom","BUÉE","AÉROSOL"],
  [113,"CIEL","PLUIE","ORAGE","Phénomène météorologique électrique et pluvieux",3,"nom","TEMÊTE","CYCLONE"],
  [114,"TERRE","AXE","SAISON","Cycle climatique annuel provoqué par l'inclinaison",4,"nom","CLIMAT","ÉQUINOXE"],
  [115,"LUNE","OCEAN","MAREE","Mouvement cyclique des eaux dû à l'attraction sélène",5,"nom","COURANT","HOULE"],
  [116,"SOLEIL","PRISME","ARC-EN-CIEL","Spectre lumineux coloré dans le ciel après l'ondée",6,"nom","SPECTRE","HALO"],
  [117,"NUCLEAIRE","ATOME","ENERGIE","Puissance colossale libérée par la matière",7,"nom","PUISSANCE","RADIATION"],
  [118,"NOIR","ESPACE","TROU-NOIR","Astre à la gravité infinie dont rien ne s'échappe",8,"nom","SINGULARITÉ","VIDE"],
  [119,"GEL","ROCHE","FISSURE","Brisure de la pierre par expansion de l'eau piégée",9,"nom","FRACTURE","ÉROSION"],
  [120,"CHIEN","CHAT","ANIMAUX","Compagnons à quatre pattes les plus communs du foyer",1,"nom","MAMMIFERE","RONGEURS"],
  [121,"ARBRE","FEUILLE","FORET","Immense espace boisé et verdoyant",1,"nom","JARDIN","VERGER"],
  [122,"SOLEIL","NUAGE","METEO","Ce qui fait la pluie et le beau temps",2,"nom","SAISON","CLIMAT"],
  [123,"OISEAU","NID","ENVOL","Action de quitter son abri pour les airs",2,"verbe","MIGRER","PLANER"],
  [124,"EAU","PIERRE","RIVIERE","Cours d'eau naturel serpentant dans la nature",2,"nom","RUISSEAU","TORRENT"],
  [125,"FLEUR","ABEILLE","BUTINER","Travailler activement le nectar des plantes",3,"verbe","VOLER","PIQUER"],
  [126,"ROSE","EPINE","PIQUANT","Qualité défensive de certains végétaux",3,"adjectif","TRANCHANT","POINTU"],
  [127,"CHEF","MEUTE","LUPIN","Relatif au canidé sauvage des bois",4,"adjectif","SAUVAGE","NOCTURNE"],
  [128,"HERBE","VACHE","BROUTER","Action de manger la végétation au sol",4,"verbe","PAITRE","RUMINER"],
  [129,"FRUIT","AUTOMNE","VERGER","Lieu de culture des arbres fruitiers",4,"nom","POTAGER","BOIS"],
  [130,"CHAT","LAIT","LAPER","Boire par petits coups avec la langue",5,"verbe","MÂCHER","AVALER"],
  [131,"OURS","HIVER","DORMIR","Passer la saison froide en sommeil profond",5,"verbe","HIBERNER","JEUNER"],
  [132,"POULE","OEUF","PONDRE","Action de donner naissance à un œuf",5,"verbe","COUVER","NICHER"],
  [133,"NATURE","LIBERTE","SAUVAGE","Qui vit librement sans intervention humaine",6,"adjectif","LIBRE","INSTINCTIF"],
  [134,"GRIFFE","CHAT","GRIFFER","Laisser sa marque avec ses ongles acérés",6,"verbe","MORDRE","BLESSER"],
  [135,"TERRE","PLANT","PLANTER","Mettre en terre pour faire pousser",7,"verbe","SEMER","ARROSER"],
  [136,"FEU","BOIS","FLAMME","Langue de feu vive et ardente",7,"nom","CENDRE","FUMEE"],
  [137,"TRONC","AGE","CERNE","Anneau témoin des années d'un arbre",7,"nom","ECORCE","NOEUD"],
  [138,"CHIEN","OS","RONGER","User lentement avec ses dents",8,"verbe","MÂCHER","MORDRE"],
  [139,"MER","PLAGE","SABLE","Fines particules minérales du littoral",8,"nom","GALET","COQUILLAGE"],
  [140,"VENT","FEUILLE","BALANCER","Osciller sous l'effet de l'air",8,"verbe","VOLER","TREMBLER"],
  [141,"LUNE","NUIT","LUNAIRE","Qui a rapport au satellite de la Terre",9,"adjectif","NOCTURNE","CELESTE"],
  [142,"LION","ROI","REGNER","Exercer son pouvoir suprême sur son domaine",9,"verbe","DOMINER","COMMANDER"],
  [143,"RACINE","SOL","ANCRER","Fixer solidement dans la terre",9,"verbe","PLANTER","ENFONCER"],
  [144,"POISSON","EAU","NAGER","Se déplacer en flottant naturellement",10,"verbe","FLOTTER","PLONGER"],
  [145,"JARDIN","FLEUR","PARFUM","Odeur agréable dégagée par la nature",10,"nom","AROME","SENTEUR"],
  [146,"NEIGE","HIVER","BLANC","Couleur immaculée du manteau froid",10,"adjectif","GIVRE","FROID"],
  [147,"GRAINE","PLANTE","POUSSER","Grandir et sortir de terre",10,"verbe","GERMER","DEVELOPPER"],
  [148,"OISEAU","CHANT","SIFFLER","Émettre des sons aigus mélodieux",10,"verbe","CHANTER","TWEETER"],
  [149,"ROMAIN","GLADIATEUR","COMBATTRE","L'action suprême dans l'arène du Colisée",1,"verbe","TRIOMPHER","DIVERTIR"],
  [150,"PYRAMIDE","EGYPTE","CONSTRUIRE","Le gigantesque effort des pharaons dans le désert",2,"verbe","MOMIFIER","MOUVOIR"],
  [151,"ROI","COURONNE","REGNER","Exercer le pouvoir suprême sur son royaume",2,"verbe","COMMANDER","GOUVERNER"],
  [152,"MOYEN-AGE","CHATEAU","DEFENDRE","Protéger la forteresse contre les sièges ennemis",3,"verbe","ASSAILLIR","FORTIFIER"],
  [153,"GAULOIS","POTION","BOIRE","Avaler le breuvage magique pour gagner en force",3,"verbe","AVALER","DEGUSTER"],
  [154,"CHEVALIER","ARMURE","PROTEGER","Mettre son corps à l'abri des coups d'épée",4,"verbe","DISSIMULER","BLINDER"],
  [155,"HISTOIRE","PASSE","RACONTER","Transmettre la mémoire des événements anciens",4,"verbe","EXPLIQUER","ENSEIGNER"],
  [156,"GREC","MYTHOLOGIE","INVENTER","Imaginer les légendes des dieux de l'Olympe",5,"verbe","SCULPTER","CONTER"],
  [157,"VIKING","BATEAU","NAVIGUER","Fendre les mers froides à bord d'un drakkar",5,"verbe","EXPLORER","VOGUER"],
  [158,"CAVERNE","HOMME","DESSINER","Tracer des figures de bison sur la roche",6,"verbe","GRAVER","PEINDRE"],
  [159,"EMPEREUR","ROME","DIRIGER","Tenir les rênes d'un immense empire antique",6,"verbe","DOMINER","COMMANDER"],
  [160,"CROISADE","TERRE","MARCHER","Avancer de longues semaines vers Jérusalem",7,"verbe","VOYAGER","PELERINER"],
  [161,"TRIBUNE","DISCOURS","PARLER","Prendre la parole devant le peuple assemblé",7,"verbe","DECLAMER","PROCLAMER"],
  [162,"ESCLAVE","CHAINES","TRAVAILLER","S'échiner durement sous la contrainte et le fer",8,"verbe","SOUFFRIR","OBÉIR"],
  [163,"JOUSTES","LANCE","CHARGER","Fonceur à cheval l'arme baissée contre le rival",8,"verbe","FRAPPER","ATTAQUER"],
  [164,"PHARAON","TOMBEAU","MOMIFIER","Préparer le corps royal pour l'éternité",9,"verbe","EMBAUMER","ENSEVELIR"],
  [165,"CONQUERANT","TERRITOIRE","ENVAHIR","Entrer par la force dans les terres ennemies",9,"verbe","OCCUPER","SOUMETTRE"],
  [166,"MONASTERE","MANUSCRIT","COPIER","Reproduire à la main les textes sacrés anciens",10,"verbe","ILLUMINER","TRADUIRE"],
  [167,"ARISTOCRATE","GUILLOTINE","PERDRE","Faire l'amère expérience de la chute sous la Terreur",10,"verbe","TREPASSER","MOURIR"],
  [168,"ANTIQUITE","TEMPLE","VENERER","Rendre un culte dévot aux divinités du passé",1,"verbe","ADORER","PRIER"],
  [169,"PREHISTOIRE","FEU","ALLUMER","Créer la première flamme salvatrice des hivers",2,"verbe","CHAUFFER","EMBRASSER"],
  [170,"EXPLOIT","HEROS","TRIOMPHER","Gagner la grande victoire légendaire",3,"verbe","SURPASSER","VAINCRE"],
  [171,"CITADELLE","SIEGE","RESISTER","Tenir bon face aux assaillants retranchés",4,"verbe","PATIENTER","BARRICADER"],
  [172,"ARCHEOLOGUE","SOL","CREUSER","Fouiller la terre pour exhumer les vestiges",5,"verbe","GRATTER","DECOUVRIR"],
  [173,"TRIBU","CHEF","OBEIR","Suivre sans rechigner les ordres du patriarche",6,"verbe","ECOUTER","RESPECTER"],
  [174,"FORGERON","EPEE","BATTRE","Frapper le métal ardent sur l'enclume",7,"verbe","FORGER","MODELER"],
  [175,"NAVIGATEUR","CARTE","EXPLORER","Partir à la découverte de terres inconnues",8,"verbe","ORIENTER","DECOUVRIR"],
  [176,"CATAPULTE","PIERRE","PROJETER","Lancer à grande distance un projectile lourd",9,"verbe","BALANCER","LANCER"],
  [177,"REVOLUTION","BASTILLE","ATTAQUER","Donner l'assaut contre la prison royale",10,"verbe","RENVERSER","LIBERER"],
  [178,"BARDE","CHANSON","LOUER","Chanter les louanges des grands guerriers d'autrefois",10,"verbe","CELEBRER","CHANTER"]
];

// Création du répertoire de données garanti dans le backend
const targetDir = path.join(__dirname, '..', 'src', 'data', 'vault');
fs.mkdirSync(targetDir, { recursive: true });

// Générer 4 paliers complets et riches à partir des énigmes authentiques
const tiers = [
  { name: 'tier1_facile', diffRange: [1, 2, 3] },
  { name: 'tier2_moyen', diffRange: [4, 5, 6] },
  { name: 'tier3_difficile', diffRange: [7, 8] },
  { name: 'tier4_expert', diffRange: [9, 10] }
];

let counter = 1000;
for (const tier of tiers) {
  const filtered = RAW_ENIGMAS.filter(e => tier.diffRange.includes(e[5]));
  const pool = (filtered.length >= 20 ? filtered : RAW_ENIGMAS).map(e => [
    counter++,
    e[1],
    e[2],
    e[3],
    e[4],
    e[5],
    e[6],
    e[7],
    e[8]
  ]);

  const filePath = path.join(targetDir, `${tier.name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(pool, null, 2), 'utf-8');
  console.log(`[VAULT EMBEDDED] ${tier.name}.json créé avec ${pool.length} énigmes réelles.`);
}
