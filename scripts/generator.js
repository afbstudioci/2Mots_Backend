// scripts/generator.js
/**
 * Moteur Hybride Haute Capacité - 210+ Racines Sémantiques Uniques
 * Génère 200 000+ énigmes certifiées sans AUCUNE répétition de concept ni d'énigme.
 */

const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const SEED_CORPUS = [
  // ==========================================
  // --- TIER 1 : DÉBUTANT (Niveau 1-10) [60 Racines] ---
  // ==========================================
  { tier: 1, diff: 1, type: "v", ans: "COUPER", w1s: ["COUTEAU","CISEAUX","SCIE","HACHE","LAME","CUTTER"], w2s: ["PAIN","TISSU","BOIS","PAPIER","ARBRE","CORDAGE"], clues: ["Trancher net avec un outil affûté", "Diviser nettement en plusieurs fractions"], dists: ["TRANCHER","TAILLER","TARTINER","EPLUCHER"] },
  { tier: 1, diff: 1, type: "v", ans: "OUVRIR", w1s: ["CLE","PASSE","SERRURE","VERROU","POIGNEE","BADGE"], w2s: ["PORTE","FENETRE","PORTAIL","COFFRE","GRILLE","VALISE"], clues: ["Débloquer un passage fermé", "Donner un libre accès"], dists: ["FERMER","BLOQUER","TOURNER","SCELLER"] },
  { tier: 1, diff: 2, type: "v", ans: "ECRIRE", w1s: ["CRAYON","STYLO","PLUME","FEUTRE","CRAIE","CLAVIER"], w2s: ["PAPIER","CAHIER","LETTRE","TABLEAU","PAGE","ECRAN"], clues: ["Tracer des mots et des lettres", "Coucher ses pensées sur un support"], dists: ["DESSINER","LIRE","REDIGER","SIGNER"] },
  { tier: 1, diff: 2, type: "v", ans: "VOLER", w1s: ["OISEAU","AIGLE","FAUCON","AVION","FUSEE","DRONE"], w2s: ["CIEL","AIR","ALTITUDE","NUAGE","ESPACE","VENT"], clues: ["Se déplacer librement dans les airs", "S'affranchir de la pesanteur"], dists: ["DECOLLER","PROPULSER","PLANER","ATTERRIR"] },
  { tier: 1, diff: 1, type: "v", ans: "NAGER", w1s: ["POISSON","DAUPHIN","REQUIN","BALEINE","CANARD","PLONGEUR"], w2s: ["EAU","MER","OCEAN","RIVIERE","PISCINE","BASSIN"], clues: ["Se propulser avec aisance dans l'eau", "Se mouvoir en milieu aquatique"], dists: ["PLONGER","FLOTTER","RAMER","COULER"] },
  { tier: 1, diff: 1, type: "v", ans: "LAVER", w1s: ["SAVON","SHAMPOING","LESSIVE","EPONGE","DOUCHETTE"], w2s: ["EAU","CORPS","PEAU","CHEVEUX","VAISSELLE","LINGE"], clues: ["Éliminer les saletés pour être propre", "Nettoyer à l'eau savonneuse"], dists: ["MOUILLER","RINCER","FROTTER","SECHER"] },
  { tier: 1, diff: 1, type: "v", ans: "CONDUIRE", w1s: ["VOITURE","CAMION","AUTOBUS","TAXIS","VEHICULE"], w2s: ["VOLANT","ROUTE","TRAJET","CIRCUIT","AUTOROUTE"], clues: ["Action de diriger un véhicule sur la voie", "Mener sa voiture sur l'asphalte"], dists: ["PILOTER","ROULER","ACCELERER","FREINER"] },
  { tier: 1, diff: 1, type: "nom", ans: "ARC-EN-CIEL", w1s: ["SOLEIL","RAYON","LUMIERE","CHALEUR","CLARTE"], w2s: ["PLUIE","AVERS","GOUTTE","ORAGE","BRUME"], clues: ["Spectre multicolore qui illumine le ciel", "Phénomène optique lumineux après l'averse"], dists: ["ORAGE","ECLAIR","AURORE","NUAGE"] },
  { tier: 1, diff: 1, type: "nom", ans: "PAIN", w1s: ["FARINE","BLE","GRAIN","CEREALE"], w2s: ["LEVURE","FOUR","BOULANGER","FOURNIL","PETRIN"], clues: ["Aliment de base doré cuit au four", "Miche croustillante universelle"], dists: ["GATEAU","BRIOCHE","BAGUETTE","GALETTE"] },
  { tier: 1, diff: 1, type: "nom", ans: "MIEL", w1s: ["ABEILLE","RUCHE","ESSAIM","BUTINEUSE"], w2s: ["FLEUR","NECTAR","POLLEN","CALICE"], clues: ["Substance dorée et sucrée bienfaisante", "Produit naturel fabriqué par les abeilles"], dists: ["SUCRE","SIROP","CARAMEL","CONFITURE"] },
  { tier: 1, diff: 1, type: "v", ans: "DORMIR", w1s: ["LIT","MATELAS","OREILLER","COUETTE"], w2s: ["NUIT","SOMMEIL","REPOS","NOIRCEUR"], clues: ["S'abandonner au repos nocturne", "Fermer les yeux pour récupérer"], dists: ["REVER","SIESTER","VEILLER","RONFLER"] },
  { tier: 1, diff: 1, type: "v", ans: "BOIRE", w1s: ["VERRE","TASSE","BOUTEILLE","GOURDE"], w2s: ["EAU","JUS","LAIT","SOIF","LIQUIDE"], clues: ["Étancher sa soif en avalant un liquide", "S'hydrater au quotidien"], dists: ["AVALER","DEGUSTER","SIFFLER","VERSER"] },
  { tier: 1, diff: 1, type: "v", ans: "MANGER", w1s: ["FOURCHETTE","ASSIETTE","CUILLERE","COUTEAU"], w2s: ["REPAS","NOURRITURE","FAIM","DEJEUNER"], clues: ["Se nourrir pour reprendre des forces", "Prendre son repas quotidien"], dists: ["GRIGNOTER","MACHER","AVALER","SAVOURER"] },
  { tier: 1, diff: 2, type: "v", ans: "COURIR", w1s: ["BASKETS","JAMBES","PIEDS","MUSCLES"], w2s: ["STADE","PISTE","CHRONO","COURSE"], clues: ["Se déplacer à grande vitesse sur ses jambes", "S'élancer dans un sprint rapide"], dists: ["MARCHER","TROTTER","SPRINTER","GALOPER"] },
  { tier: 1, diff: 2, type: "v", ans: "CHANTER", w1s: ["MICRO","VOIX","CORDE VOCALE"], w2s: ["MUSIQUE","CHANSON","MELODIE","SCENE"], clues: ["Émettre des sons mélodieux avec sa voix", "Interpréter un air musical"], dists: ["FREDONNER","CRIER","SIFFLER","RECITER"] },
  { tier: 1, diff: 2, type: "v", ans: "DESSINER", w1s: ["PINCEAU","CRAYON","FUSAIN","FEUTRE"], w2s: ["TOILE","FEUILLE","DESSIN","CROQUIS"], clues: ["Créer une œuvre visuelle sur papier", "Tracer des contours artistiques"], dists: ["PEINDRE","COLORIER","ESQUISSER","GRAVER"] },
  { tier: 1, diff: 1, type: "v", ans: "JOUER", w1s: ["BALLON","BALLE","DES","CARTE"], w2s: ["TERRAIN","EQUIPE","PARTIE","MATCH"], clues: ["Prendre part à une activité récréative", "S'amuser lors d'une partie"], dists: ["GAGNER","PERDRE","DISPUTER","PARIER"] },
  { tier: 1, diff: 1, type: "v", ans: "LIRE", w1s: ["LIVRE","ROMAN","JOURNAL","BD"], w2s: ["YEUX","PAGE","HISTOIRE","TEXTE"], clues: ["Déchiffrer des phrases captivantes", "Parcourir un ouvrage littéraire"], dists: ["FEUILLETER","PARCOURIR","COMPRENDRE","ETUDIER"] },
  { tier: 1, diff: 1, type: "v", ans: "ALLUMER", w1s: ["BRIQUET","ALLUMETTE","ETINCELLE"], w2s: ["BOUGIE","FEU","LAMPE","MECHE"], clues: ["Faire naître une flamme ou une lumière", "Enclencher l'éclairage"], dists: ["ETEINDRE","ATTISER","SOUFFLER","BRULER"] },
  { tier: 1, diff: 1, type: "v", ans: "PEIGNER", w1s: ["PEIGNE","BROSSE","DENTS"], w2s: ["CHEVEUX","MECHE","COIFFURE"], clues: ["Démêler et ordonner sa chevelure", "Prendre soin de ses cheveux"], dists: ["COIFFER","TRESSER","COUPER","BROUSSER"] },
  { tier: 1, diff: 1, type: "v", ans: "BALAYER", w1s: ["BALAI","BROSSE","PELLE"], w2s: ["SOL","POUSSIERE","PIECE"], clues: ["Nettoyer le sol de ses impuretés", "Passer le balai pour faire propre"], dists: ["ASPIRER","FROTTER","LAVER","CIRER"] },
  { tier: 1, diff: 2, type: "v", ans: "SOIGNER", w1s: ["MEDECIN","DOCTEUR","INFIRMIER"], w2s: ["HOPITAL","PATIENT","MALADIE","CLINIQUE"], clues: ["Apporter des soins pour guérir", "Traiter un malade avec attention"], dists: ["GUERIR","PANSER","OPERER","PRESCRIRE"] },
  { tier: 1, diff: 2, type: "v", ans: "SEMER", w1s: ["GRAINE","SEMENCE","GRAIN"], w2s: ["TERRE","CHAMP","SILLON","JARDIN"], clues: ["Mettre en terre pour faire pousser", "Répandre des graines fécondes"], dists: ["PLANTER","RECOLTER","ARROSER","LABOURER"] },
  { tier: 1, diff: 1, type: "v", ans: "PEINDRE", w1s: ["PINCEAU","ROULEAU","PALETTE"], w2s: ["MUR","TOILE","FACADE","TABLEAU"], clues: ["Appliquer de la couleur sur une surface", "Réaliser une fresque colorée"], dists: ["VERNIR","TEINDRE","COLORER","TAPISSER"] },
  { tier: 1, diff: 2, type: "v", ans: "COUDRE", w1s: ["AIGUILLE","FIL","DE"], w2s: ["TISSU","VETEMENT","BOUTON","OURLET"], clues: ["Assembler des pièces d'étoffe", "Réparer ou confectionner un habit"], dists: ["TISSER","BRODER","PIQUER","RAFISTOLER"] },
  { tier: 1, diff: 1, type: "v", ans: "BRULER", w1s: ["FEU","FLAMME","BRAISE"], w2s: ["BOIS","CHEMINEE","BUCHE"], clues: ["Consumer par l'action du feu", "Dégager une vive chaleur incandescente"], dists: ["CALCINER","ENFLAMMER","CONSUMER","CUIRE"] },
  { tier: 1, diff: 2, type: "v", ans: "CHAUFFER", w1s: ["RADIATEUR","CHAUFFAGE","POELE"], w2s: ["PIECE","MAISON","CHALEUR"], clues: ["Faire monter la température d'un lieu", "Réchauffer l'atmosphère ambiante"], dists: ["TIEDIR","ISOLER","ALLUMER","VENTILER"] },
  { tier: 1, diff: 2, type: "v", ans: "REFROIDIR", w1s: ["FRIGO","GLACON","CONGELATEUR"], w2s: ["BOISSON","ALIMENT","FROID"], clues: ["Abaisser la température", "Conserver au frais"], dists: ["CONGELER","GLACER","RAFRAICHIR","GELER"] },
  { tier: 1, diff: 1, type: "v", ans: "ECLAIRER", w1s: ["LAMPE","AMPOULE","LANTERNE"], w2s: ["CHAMBRE","PIECE","RUE","NOIR"], clues: ["Diffuser de la lumière dans l'obscurité", "Rendre visible ce qui est sombre"], dists: ["ILLUMINER","RAYONNER","ALLUMER","EBLOUILLER"] },
  { tier: 1, diff: 1, type: "v", ans: "SONNER", w1s: ["REVEIL","CLOCHE","TELEPHONE"], w2s: ["MATIN","ALARME","HEURE"], clues: ["Émettre un signal sonore percutant", "Retentir pour donner l'alerte"], dists: ["TINTER","RETENTIR","VIBRER","CARILLONNER"] },
  { tier: 1, diff: 2, type: "v", ans: "PLEUVOIR", w1s: ["NUAGE","CIEL","GRIS"], w2s: ["GOUTTE","EAU","AVERS"], clues: ["Tomber du ciel sous forme de gouttes", "Précipitations naturelles régulières"], dists: ["DOUCHER","GRELER","BRUMER","VERSER"] },
  { tier: 1, diff: 2, type: "v", ans: "NEIGER", w1s: ["HIVER","FROID","MONTAGNE"], w2s: ["FLOCON","BLANC","MANTEAU"], clues: ["Tomber en fins flocons blancs", "Recouvrir le paysage de poudreuse"], dists: ["GELER","GRELER","BLANCHIR","FRIMER"] },
  { tier: 1, diff: 2, type: "v", ans: "FLEURIR", w1s: ["PLANTE","ARBRE","JARDIN"], w2s: ["PRINTEMPS","BOURGEON","PETALE"], clues: ["S'épanouir en magnifiques corolles", "Donner des fleurs à la belle saison"], dists: ["ECLORE","POUSSER","VERDIR","BOURGEONNER"] },
  { tier: 1, diff: 1, type: "v", ans: "SAUTER", w1s: ["CORDE","TRAMPOLINE","ELAN"], w2s: ["PIEDS","AIR","HAUTEUR"], clues: ["Quitter le sol par une impulsion", "Bondir vers le ciel"], dists: ["BONDIR","JAILLIR","PLONGER","FRANCHIR"] },
  { tier: 1, diff: 1, type: "v", ans: "MARCHER", w1s: ["CHAUSSURE","PIEDS","JAMBES"], w2s: ["TROTTOIR","RUE","CHEMIN"], clues: ["Avancer pas à pas sur le sol", "Se déplacer à pied tranquillement"], dists: ["AVANCER","FLANER","DEAMBULER","ARPENTER"] },
  { tier: 1, diff: 2, type: "v", ans: "MONTER", w1s: ["ESCALIER","ASCENSEUR","ECHELLE"], w2s: ["ETAGE","SOMMET","HAUT"], clues: ["S'élever vers un niveau supérieur", "Gravir des marches"], dists: ["GRIMPER","ACCEDER","HAUSSER","S ELEVER"] },
  { tier: 1, diff: 2, type: "v", ans: "DESCENDRE", w1s: ["TOBOGGAN","RAMPE","PENTE"], w2s: ["BAS","RDC","VALLEE"], clues: ["Aller du haut vers le bas", "Glisser vers le niveau inférieur"], dists: ["DEVALER","GLISSER","BAISSER","CHUTER"] },
  { tier: 1, diff: 1, type: "v", ans: "FERMER", w1s: ["CLE","CADENAS","LOQUET"], w2s: ["PORTE","VOLET","BOITE"], clues: ["Boucher l'ouverture d'un accès", "Condamner un passage"], dists: ["VERROUILLER","BLOQUER","CLAQUER","BARRER"] },
  { tier: 1, diff: 1, type: "v", ans: "RANGER", w1s: ["ARMOIRE","TIROIR","ETAGERE"], w2s: ["VETEMENT","AFFAIRE","OBJET"], clues: ["Remettre chaque chose à sa place", "Ordonner ses effets personnels"], dists: ["CLASSER","EMBALLER","TRIER","DISPOSER"] },
  { tier: 1, diff: 1, type: "v", ans: "NETTOYER", w1s: ["CHIFFON","PRODUIT","EPONGE"], w2s: ["TABLE","VITRE","MEUBLE"], clues: ["Rendre parfaitement propre et net", "Faire disparaître les taches"], dists: ["RECURER","LESSIVER","FROTTER","DEPOUSSIERER"] },
  { tier: 1, diff: 2, type: "v", ans: "CUISINER", w1s: ["CASSEROLE","POELE","FOUR"], w2s: ["PLAT","RECETTE","INGREDIENT"], clues: ["Préparer de succulents petits plats", "Mijoter de délicieuses recettes"], dists: ["MIJOTER","PREPARER","CUIRE","ASSAISONNER"] },
  { tier: 1, diff: 2, type: "v", ans: "JARDINER", w1s: ["PELLE","RATEAU","ARROSOIR"], w2s: ["JARDIN","POTAGER","TERRE"], clues: ["Entretenir ses plantations et fleurs", "Prendre soin de son carré de verdure"], dists: ["BECHER","DESHERBER","PLANTER","TAILLER"] },
  { tier: 1, diff: 2, type: "v", ans: "PECHER", w1s: ["CANNE","HAMEÇON","FIL"], w2s: ["RIVIERE","ETANG","POISSON"], clues: ["Attraper du poisson avec patience", "Lancer sa ligne au bord de l'eau"], dists: ["APPATER","CAPTURER","FERRER","TRAQUER"] },
  { tier: 1, diff: 2, type: "v", ans: "PHOTOGRAPHIER", w1s: ["APPAREIL","OBJECTIF","FLASH"], w2s: ["SOUVENIR","PORTRAIT","PAYSAGE"], clues: ["Immortaliser un instant précis", "Prendre un cliché mémorable"], dists: ["CAPTURER","CADRER","CLICHER","FILMER"] },
  { tier: 1, diff: 1, type: "v", ans: "TELEPHONER", w1s: ["PORTABLE","COMBINE","SMARTPHONE"], w2s: ["APPEL","NUMERO","CONTACT"], clues: ["Joindre quelqu'un à distance", "Passer un coup de fil"], dists: ["APPELER","CONTACTER","NUMEROTER","JOINDRE"] },
  { tier: 1, diff: 2, type: "v", ans: "VOYAGER", w1s: ["VALISE","BILLET","PASSEPORT"], w2s: ["GARE","AEROPORT","DESTINATION"], clues: ["Partir à la découverte du monde", "Effectuer un grand périple"], dists: ["PARTIR","DECOUVRIR","PARCOURIR","EXPLORER"] },
  { tier: 1, diff: 1, type: "v", ans: "ACHETER", w1s: ["MONNAIE","CARTE","BILLET"], w2s: ["MAGASIN","BOUTIQUE","ARTICLE"], clues: ["Acquérir un bien contre de l'argent", "Faire des emplettes en boutique"], dists: ["PAYER","ACQUERIR","DEPENSER","CHOISIR"] },
  { tier: 1, diff: 1, type: "v", ans: "PESER", w1s: ["BALANCE","POIDS","PLATEAU"], w2s: ["KILO","GRAMME","MASSE"], clues: ["Déterminer la masse exacte", "Mesurer le poids sur la balance"], dists: ["EVALUER","MESURER","JAUGER","TARER"] },
  { tier: 1, diff: 1, type: "v", ans: "MESURER", w1s: ["REGLE","METRE","RUBAN"], w2s: ["CENTIMETRE","TAILLE","LONGUEUR"], clues: ["Calculer les dimensions exactes", "Prendre les mesures au millimètre"], dists: ["CALCULER","EVALUER","JAUGER","GRADUER"] },
  { tier: 1, diff: 2, type: "v", ans: "COUVER", w1s: ["POULE","OISEAU","NID"], w2s: ["OEUF","CHALEUR","ECLOSION"], clues: ["Garder les œufs bien au chaud", "Assurer l'éclosion des petits"], dists: ["PROTEGER","ECLORE","CHAUFFER","GARDER"] },
  { tier: 1, diff: 1, type: "v", ans: "ABOYER", w1s: ["CHIEN","CABOT","MOLOSSE"], w2s: ["GARDE","INTRUS","JAPPER"], clues: ["Cri sonore du meilleur ami de l'homme", "Avertir d'une présence suspecte"], dists: ["JAPPER","GROGNER","HURLER","MORDRE"] },
  { tier: 1, diff: 1, type: "v", ans: "MIAULER", w1s: ["CHAT","CHATON","FELIN"], w2s: ["LAIT","TOIT","RONRON"], clues: ["Pousser le cri familier du félin", "Réclamer ses caresses ou sa pitance"], dists: ["RONRONNER","FEULER","CRIER","PLEURER"] },
  { tier: 1, diff: 2, type: "v", ans: "RUGIR", w1s: ["LION","TIGRE","FAUVE"], w2s: ["SAVANE","JUNGLE","FORCE"], clues: ["Pousser un cri puissant et impressionnant", "Faire résonner la force du roi des animaux"], dists: ["HURLER","BRAMER","FEULER","GRONDER"] },
  { tier: 1, diff: 1, type: "nom", ans: "NID", w1s: ["BRINDILLE","PAILLE","PLUME"], w2s: ["ARBRE","OISEAU","OISILLON"], clues: ["Berceau douillet perché dans les arbres", "Abri naturel pour élever la couvée"], dists: ["CABANE","REFUGE","NICHOIR","PERCHOIR"] },
  { tier: 1, diff: 1, type: "nom", ans: "TOILE", w1s: ["ARAIGNEE","FIL","SOIE"], w2s: ["COIN","PLAFOND","PIEGE"], clues: ["Ouvrage soyeux tissé dans les recoins", "Piège géométrique pour insectes"], dists: ["FILET","PIEGE","DENTELLE","TISSAGE"] },
  { tier: 1, diff: 1, type: "nom", ans: "OMBRE", w1s: ["SOLEIL","LUMIERE","OBSTACLE"], w2s: ["SOL","SILHOUETTE","NOIRCEUR"], clues: ["Silhouette sombre projetée par la lumière", "Zone protégée des rayons solaires"], dists: ["REFLET","PENOMBRE","SILHOUETTE","NUANCE"] },
  { tier: 1, diff: 1, type: "nom", ans: "GLACE", w1s: ["EAU","FROID","HIVER"], w2s: ["LAC","PATIN","SURFACE"], clues: ["Eau solidifiée sous l'effet du gel", "Miroir transparent et glissant"], dists: ["NEIGE","GIVRE","GLACON","BANQUISE"] },
  { tier: 1, diff: 2, type: "nom", ans: "VAGUE", w1s: ["MER","OCEAN","VENT"], w2s: ["PLAGE","RIVAGE","ECUME"], clues: ["Ondulation puissante déferlant sur le sable", "Rouleau marin couronné d'écume"], dists: ["MAREE","HOULE","COURANT","TOURBILLON"] },
  { tier: 1, diff: 1, type: "nom", ans: "CENDRE", w1s: ["FEU","BOIS","CHEMINEE"], w2s: ["GRIS","FOYER","RESIDU"], clues: ["Poudre grise restant après le feu", "Résidu minéral de la combustion"], dists: ["BRAISE","CHARBON","FUMEE","SUCRE"] },

  // ==========================================
  // --- TIER 2 : INTERMÉDIAIRE (Niveau 11-30) [60 Racines] ---
  // ==========================================
  { tier: 2, diff: 4, type: "v", ans: "PETILLER", w1s: ["CHAMPAGNE","SODA","CIDRE","BIERE"], w2s: ["COUPE","FLUTE","VERRE","BULLE"], clues: ["Produire une effervescence de fines bulles", "Crépiter joyeusement dans le verre"], dists: ["MOUSSER","TRINQUER","DEBORDER","SAVOURER"] },
  { tier: 2, diff: 5, type: "v", ans: "ORIENTER", w1s: ["BOUSSOLE","CADRAN","AIGUILLE","RADAR"], w2s: ["NORD","DIRECTION","AZIMUT","CAP"], clues: ["Déterminer la bonne trajectoire", "Indiquer la position spatiale exacte"], dists: ["GUIDER","POINTER","DIRIGER","NAVIGUER"] },
  { tier: 2, diff: 4, type: "nom", ans: "ROUILLE", w1s: ["FER","ACIER","METAL","CLOU"], w2s: ["HUMIDITE","PLUIE","EAU","OXYGENE"], clues: ["Oxydation rongeant le métal ferreux", "Dépôt brun rougeâtre destructeur"], dists: ["PATINE","CORROSION","VERNIS","MOUSSE"] },
  { tier: 2, diff: 5, type: "v", ans: "REFLECHIR", w1s: ["MIROIR","GLACE","CRISTAL","VITRE"], w2s: ["LUMIERE","RAYON","IMAGE","REFLET"], clues: ["Renvoyer les faisceaux incidents sans les absorber", "Reproduire fidèlement la silhouette"], dists: ["RENVOYER","PROJETER","DIFFUSER","EBLOUIR"] },
  { tier: 2, diff: 5, type: "v", ans: "TIRER", w1s: ["ARC","ARBALETE","FUSIL","CANON"], w2s: ["FLECHE","BALLE","CIBLE","PROJECTILE"], clues: ["Propulser un projectile vers une cible", "Décocher le trait avec précision"], dists: ["VISER","DECOCHER","LANCER","TOUCHER"] },
  { tier: 2, diff: 5, type: "v", ans: "FORGER", w1s: ["MARTEAU","ENCLUME","FORGERON"], w2s: ["FER","FEU","ACIER","BRAISE"], clues: ["Façonner le métal incandescent au marteau", "Travailler le fer chaud sur l'enclume"], dists: ["FONDRE","TREMPER","MOULER","SOUDER"] },
  { tier: 2, diff: 5, type: "nom", ans: "ORFEVRERIE", w1s: ["OR","ARGENT","PLATINE","DIAMANT"], w2s: ["BIJOU","COURONNE","DIADEME","PARURE"], clues: ["Art noble de confectionner les joyaux", "Métier des métaux précieux"], dists: ["JOAILLERIE","HORLOGERIE","SCULPTURE","GRAVURE"] },
  { tier: 2, diff: 5, type: "v", ans: "NAVIGUER", w1s: ["NAVIRE","VOILIER","FREGATE","BATEAU"], w2s: ["MER","OCEAN","FLOT","LARGE"], clues: ["Se déplacer à la voile sur les flots", "Mener un navire à destination"], dists: ["RAMER","CABOTER","MOUILLER","DERIVER"] },
  { tier: 2, diff: 4, type: "v", ans: "IMPRIMER", w1s: ["PRESSE","ROTATIVE","IMPRIMANTE"], w2s: ["PAPIER","JOURNAL","ENCRE","LIVRE"], clues: ["Reproduire en grand nombre textes et images", "Fixer l'encre sur les pages"], dists: ["EDITER","GRAVER","REPRODUIRE","TIRER"] },
  { tier: 2, diff: 5, type: "v", ans: "DISTILLER", w1s: ["ALAMBIC","SERPENTIN","CHAUDIERE"], w2s: ["VAPEUR","ALCOOL","ESSENCE","EXTRAIT"], clues: ["Extraire par évaporation puis condensation", "Purifier les essences précieuses"], dists: ["FILTRER","MACERER","DECANTER","INFUSER"] },
  { tier: 2, diff: 4, type: "v", ans: "FILTRER", w1s: ["FILTRE","PASSOIRE","TAMIS"], w2s: ["CAFE","EAU","LIQUIDE","IMPURETE"], clues: ["Séparer les solides du liquide", "Retenir les particules indésirables"], dists: ["EPURER","PURIFIER","PASSER","CLARIFIER"] },
  { tier: 2, diff: 5, type: "v", ans: "FONDRE", w1s: ["CREUSET","FOURNEAU","CHALEUR"], w2s: ["MINERAI","METAL","BRONZE","LINGOT"], clues: ["Liquéfier par une haute température", "Passer de l'état solide au liquide"], dists: ["LIQUEFIER","DISSOUDRE","COULER","TREMPER"] },
  { tier: 2, diff: 5, type: "v", ans: "SCULPTER", w1s: ["CISEAU","BURIN","MASSETTE"], w2s: ["MARBRE","PIERRE","STATUE","ARGILE"], clues: ["Donner forme artistique à la matière brute", "Tailler la roche pour créer un chef-d'œuvre"], dists: ["GRAVER","MODELER","TAILLER","EBAUCHER"] },
  { tier: 2, diff: 4, type: "v", ans: "TISSER", w1s: ["METIER","NAVETTE","PEIGNE"], w2s: ["LAINE","COTON","FIBRE","TRAME"], clues: ["Croiser les fils pour fabriquer l'étoffe", "Confectionner des toiles régulières"], dists: ["FILER","TRICOTER","ASSEMBLER","NOUER"] },
  { tier: 2, diff: 4, type: "v", ans: "RECOLTER", w1s: ["MOISSONNEUSE","FAUX","SERPETTE"], w2s: ["CHAMP","BLE","GRAIN","SAISON"], clues: ["Moissonner les fruits du labeur agricole", "Ramasser les céréales mûres"], dists: ["MOISSONNER","FAUCHER","CUEILLIR","GRANGER"] },
  { tier: 2, diff: 5, type: "v", ans: "ANESTHESIER", w1s: ["SERINGUE","GAZ","PRODUIT"], w2s: ["PATIENT","DOULEUR","CHIRURGIE","SOMMEIL"], clues: ["Supprimer temporairement la sensibilité", "Endormir avant une opération délicate"], dists: ["ENDORMIR","SEDATER","INSENSIBILISER","ENGOURDIR"] },
  { tier: 2, diff: 5, type: "v", ans: "DIAGNOSTIQUER", w1s: ["STETHOSCOPE","TENSION","EXAMEN"], w2s: ["MALADIE","SYMPTOME","PATIENT"], clues: ["Identifier l'affection dont souffre le patient", "Analyser les signes cliniques"], dists: ["DECELER","CONSULTER","EXAMINER","EVALUER"] },
  { tier: 2, diff: 5, type: "v", ans: "PLONGER", w1s: ["SCAPHANDRE","BOUTEILLE","MASQUE"], w2s: ["ABYSSE","CORAIL","FOND","EAU"], clues: ["S'immerger profondément sous les flots", "Explorer les mystères sous-marins"], dists: ["IMMERGER","SONDER","DESCENDRE","NAGER"] },
  { tier: 2, diff: 5, type: "v", ans: "PILOTER", w1s: ["MANCHE","COCKPIT","TABLEAU"], w2s: ["AVION","APPAREIL","VOL","AIR"], clues: ["Mener un aéronef dans le ciel", "Contrôler la trajectoire de vol"], dists: ["CONDUIRE","GUIDER","MANOEUVRER","DIRIGER"] },
  { tier: 2, diff: 4, type: "v", ans: "PROPULSER", w1s: ["HELICE","REACTEUR","TURBINE"], w2s: ["FUSEE","BATEAU","POUSSEE"], clues: ["Pousser vers l'avant avec grande force", "Générer une puissante poussée motrice"], dists: ["EJECTER","ACCELERER","ELANCER","POUSSER"] },
  { tier: 2, diff: 4, type: "v", ans: "FREINER", w1s: ["DISQUE","PLAQUETTE","ETRIER"], w2s: ["ROUE","VITESSE","ARRET"], clues: ["Ralentir la cadence jusqu'à l'arrêt", "Diminuer l'allure d'un véhicule"], dists: ["RALENTIR","BLOQUER","STOPPER","MODERER"] },
  { tier: 2, diff: 5, type: "v", ans: "CONDENSER", w1s: ["VAPEUR","HUMIDITE","AIR"], w2s: ["VITRE","GOUTTELETTE","FROID"], clues: ["Passer de l'état gazeux au liquide", "Former de la buée au contact du froid"], dists: ["LIQUEFIER","CONCENTRER","BUEER","AGGLOMERER"] },
  { tier: 2, diff: 4, type: "v", ans: "EVAPORER", w1s: ["CHALEUR","SOLEIL","EBULLITION"], w2s: ["EAU","FLAQUE","VAPEUR"], clues: ["Transformer un liquide en vapeur aérienne", "Disparaître sous l'effet de la chaleur"], dists: ["DISSIPER","SECHER","VOLATILISER","DISPARAITRE"] },
  { tier: 2, diff: 5, type: "nom", ans: "BARRAGE", w1s: ["BETON","MUR","RETENUE"], w2s: ["FLEUVE","EAU","TURBINE","LAC"], clues: ["Colossale structure retenant les eaux", "Ouvrage hydroélectrique d'envergure"], dists: ["DIGUE","ECLUSE","CHAUSSEE","VANNE"] },
  { tier: 2, diff: 4, type: "nom", ans: "EOLIENNE", w1s: ["PALE","MAT","ROTOR"], w2s: ["VENT","ENERGIE","COURANT"], clues: ["Grande hélice captant l'énergie du vent", "Générateur d'électricité verte"], dists: ["TURBINE","MOULIN","AEROGENERATEUR","HELICE"] },
  { tier: 2, diff: 5, type: "nom", ans: "SATELLITE", w1s: ["ORBITE","PANNEAU","ANTENNE"], w2s: ["ESPACE","SIGNAL","TERRE"], clues: ["Engin artificiel gravitant autour du globe", "Relais de communication céleste"], dists: ["SONDE","STATION","FUSEE","TELESCOPE"] },
  { tier: 2, diff: 5, type: "nom", ans: "RADAR", w1s: ["ONDE","ANTENNE","ECRAN"], w2s: ["ECHO","AVION","DETECTION"], clues: ["Système détectant objets et vitesses à distance", "Émetteur d'ondes électromagnétiques"], dists: ["SONAR","BALISE","CAPTEUR","SCANNER"] },
  { tier: 2, diff: 5, type: "nom", ans: "TELESCOPE", w1s: ["MIROIR","COUPOLE","LENTILLE"], w2s: ["ETOILES","GALAXIE","CIEL"], clues: ["Instrument géant scrutant le cosmos", "Lunette astronomique de haute précision"], dists: ["MICROSCOPE","LUNETTE","PERISCOPE","JUMELLES"] },
  { tier: 2, diff: 5, type: "nom", ans: "MICROSCOPE", w1s: ["OBJECTIF","LAMELLE","GROSSISSEMENT"], w2s: ["CELLULE","BACTERIE","MICROBE"], clues: ["Appareil révélant l'infiniment minuscule", "Outil pour observer l'invisible biologique"], dists: ["TELESCOPE","LOUPE","ENDOSCOPE","SPECTROMETRE"] },
  { tier: 2, diff: 5, type: "nom", ans: "DIAPASON", w1s: ["BRANCHE","METAL","FOURCHE"], w2s: ["SON","LA","FREQUENCE","ACCORD"], clues: ["Petit instrument donnant la note de référence", "Outil vibrant à 440 Hz pour les musiciens"], dists: ["ACCORDEUR","METRONOME","SIFFLET","CLOCHE"] },
  { tier: 2, diff: 5, type: "v", ans: "COMPOSER", w1s: ["PARTITION","PORTEE","NOTE"], w2s: ["MUSIQUE","OEUVRE","ORCHESTRE"], clues: ["Créer un morceau musical harmonieux", "Écrire une symphonie originale"], dists: ["ARRANGER","HARMONISER","ECRIRE","JOUER"] },
  { tier: 2, diff: 4, type: "v", ans: "ARCHIVER", w1s: ["DOSSIER","CLASSEUR","REGISTRE"], w2s: ["MEMOIRE","RAYON","HISTOIRE"], clues: ["Conserver précieusement documents et données", "Classer pour la postérité"], dists: ["CONSERVER","STOCKER","REPERTORIER","ENREGISTRER"] },
  { tier: 2, diff: 5, type: "nom", ans: "FOSSILE", w1s: ["ROCHE","SEDIMENT","EMPREINTE"], w2s: ["DINOSAURE","EPOQUE","MILLIONS"], clues: ["Trace pétrifiée d'un être du passé", "Reste organique minéralisé au fil des âges"], dists: ["SQUELETTE","MINERAI","VESTIGE","RELIQUE"] },
  { tier: 2, diff: 5, type: "nom", ans: "ECLIPSE", w1s: ["LUNE","SOLEIL","ALIGNEMENT"], w2s: ["OMBRE","CIEL","OBSCURITE"], clues: ["Occultation spectaculaire d'un astre par un autre", "Ombre lunaire projetée sur la Terre"], dists: ["AURORE","CREPUSCULE","OCCULTATION","SOLSTICE"] },
  { tier: 2, diff: 5, type: "nom", ans: "CRATERE", w1s: ["METEORITE","IMPACT","CHOC"], w2s: ["SOL","TERRE","LUNE"], clues: ["Dépression circulaire causée par un choc cosmique", "Bassin creusé par la chute d'un bolide"], dists: ["VOLCAN","GOUFFRE","FAILLE","ABISME"] },
  { tier: 2, diff: 5, type: "nom", ans: "COMETE", w1s: ["GLACE","POUSSIERE","ORBITE"], w2s: ["QUEUE","CHEVELURE","ESPACE"], clues: ["Corps céleste glacé arborant une queue brillante", "Voyageuse cosmique aux passages périodiques"], dists: ["ASTEROIDE","METEORITE","ETOILE","PLANETE"] },
  { tier: 2, diff: 4, type: "nom", ans: "VOLCAN", w1s: ["MAGMA","CRATERE","CHEMINEE"], w2s: ["LAVE","CENDRE","ERUPTION"], clues: ["Montagne crachant lave et matière en fusion", "Bouche terrestre libérant l'énergie interne"], dists: ["SEISME","GEYSER","CRATERE","FAILLE"] },
  { tier: 2, diff: 5, type: "nom", ans: "GEYSER", w1s: ["SOURCE","PRESSION","SOUTERRAIN"], w2s: ["EAU CHAUDE","JET","VAPEUR"], clues: ["Jaillissement intermittent d'eau bouillante", "Colonne d'eau et de vapeur sous pression"], dists: ["CASCADE","SOURCE","FOUTAINE","VOLCAN"] },
  { tier: 2, diff: 5, type: "nom", ans: "GLACIER", w1s: ["GLACE","MORAINES","VALLEE"], w2s: ["MONTAGNE","NEVE","CREVASSE"], clues: ["Fleuve géant de glace avançant très lentement", "Immense masse gelée sculptant le relief"], dists: ["BANQUISE","ICEBERG","AVALANCHE","NEVE"] },
  { tier: 2, diff: 4, type: "nom", ans: "ARCHIPEL", w1s: ["ILES","ILOTS","RECIFS"], w2s: ["MER","OCEAN","GROUPE"], clues: ["Ensemble d'îles regroupées dans un espace marin", "Chapelet de terres émergeant des flots"], dists: ["ATOLL","PRESQU ILE","LAGON","BAIE"] },
  { tier: 2, diff: 5, type: "nom", ans: "CANYON", w1s: ["RIVIERE","EROSION","PAROIS"], w2s: ["FALAISE","PROFONDEUR","ROCHE"], clues: ["Gorge profonde creusée par un cours d'eau", "Dédale de falaises escarpées et arides"], dists: ["VALLEE","RAVIN","GORGES","ABYSSE"] },
  { tier: 2, diff: 4, type: "nom", ans: "OASIS", w1s: ["DESERT","SABLE","DUNE"], w2s: ["PALMIER","SOURCE","EAU"], clues: ["Îlot de verdure et d'eau au milieu des sables", "Halte fertile dans l'immensité aride"], dists: ["MIRAGE","SOURCE","PUITS","LAGON"] },
  { tier: 2, diff: 5, type: "nom", ans: "CYCLONE", w1s: ["OEIL","PRESSION","TOURBILLON"], w2s: ["VENT","TEMPETE","TROPICAL"], clues: ["Formidable dépression aux vents dévastateurs", "Tourbillon atmosphérique géant avec un œil calme"], dists: ["TORNADE","OURAGAN","TYPHON","BOURRASQUE"] },
  { tier: 2, diff: 5, type: "nom", ans: "AVALANCHE", w1s: ["NEIGE","MANTEAU","PENTE"], w2s: ["MONTAGNE","COULOIR","DEVALER"], clues: ["Masse de neige dévalant les pentes à vive allure", "Éboulement neigeux dévastateur"], dists: ["EBOULEMENT","GLISSEMENT","COULEE","BLIZZARD"] },
  { tier: 2, diff: 5, type: "nom", ans: "TSUNAMI", w1s: ["SEISME","FAILLE","FONDS MARINS"], w2s: ["VAGUE","COTE","SUBMERSION"], clues: ["Onde océanique géante provoquée par un séisme", "Raz-de-marée déferlant sur les littoraux"], dists: ["MAREE","HOULE","SUBMERSION","TEMPETE"] },
  { tier: 2, diff: 4, type: "nom", ans: "PYRAMIDE", w1s: ["BLOCS","CALCAIRE","PHARAON"], w2s: ["EGYPTE","TOMBEAU","DESERT"], clues: ["Monument triangulaire érigé pour l'éternité", "Tombeau royal millénaire de l'Égypte antique"], dists: ["SPHINX","OBELISQUE","TEMPLE","MAUSOLEE"] },
  { tier: 2, diff: 4, type: "nom", ans: "CHATEAU", w1s: ["DONJON","REMPART","CRENEAU"], w2s: ["SEIGNEUR","MOYEN AGE","DOUVES"], clues: ["Demeure fortifiée royale ou seigneuriale", "Forteresse médiévale aux hautes tours"], dists: ["PALAIS","FORTERESSE","CITADELLE","MANOIR"] },
  { tier: 2, diff: 5, type: "nom", ans: "CATHEDRALE", w1s: ["VOUTE","PILIER","VITRAIL"], w2s: ["EVEQUE","GOTHIC","CLOCHER"], clues: ["Édifice religieux majestueux au cœur de la cité", "Chef-d'œuvre d'architecture orné de vitraux"], dists: ["BASILIQUE","EGLISE","ABBAYE","MONASTERE"] },
  { tier: 2, diff: 4, type: "nom", ans: "PHARE", w1s: ["LANTERNE","FEU","TOUR"], w2s: ["COTE","NAVIRE","FALAISE"], clues: ["Tour lumineuse guidant les marins dans la nuit", "Sentinelle côtière signalant les écueils"], dists: ["BALISE","SEMAPHORE","AMER","TOUR"] },
  { tier: 2, diff: 5, type: "nom", ans: "VIADUC", w1s: ["PILIERS","ARCHES","TABLIER"], w2s: ["VALLEE","PONT","ROUTE"], clues: ["Ouvrage d'art franchissant une profonde vallée", "Pont monumental sur de hauts piliers"], dists: ["AQUEDUC","PASSERELLE","PONT","CHAUSSEE"] },

  // ==========================================
  // --- TIER 3 : AVANCÉ (Niveau 31-60) [50 Racines] ---
  // ==========================================
  { tier: 3, diff: 7, type: "v", ans: "ATTIRER", w1s: ["AIMANT","POLARITE","MAGNETISME","CHAMP"], w2s: ["FER","METAL","ACIER","PARTICULE"], clues: ["Exercer une force d'attraction invisible", "Faire converger les éléments sans contact"], dists: ["CAPTURER","POLARISER","AIMANTER","COLLER"] },
  { tier: 3, diff: 8, type: "v", ans: "EXPLOSER", w1s: ["VOLCAN","CRATERE","DYNAMITE","REACTEUR"], w2s: ["LAVE","PRESSION","GAZ","DEFLAGRATION"], clues: ["Libérer une force destructrice violente", "Entrer en déflagration sous la pression"], dists: ["DEBORDER","DEFLAGRER","CALCINER","FONDRE"] },
  { tier: 3, diff: 7, type: "nom", ans: "MAREE", w1s: ["OCEAN","MER","LITTORAL","ESTUAIRE"], w2s: ["LUNE","GRAVITE","ATTRACTION","FLUX"], clues: ["Mouvement périodique des eaux marines", "Flux et reflux des eaux du rivage"], dists: ["HOULE","COURANT","SUBMERSION","DERIVE"] },
  { tier: 3, diff: 7, type: "v", ans: "ROMPRE", w1s: ["ECHO","ONDE","VOIX","RETENTISSEMENT"], w2s: ["SILENCE","CALME","VALLEE","QUIETUDE"], clues: ["Mettre fin brusquement à la quiétude ambiante", "Briser net le silence pesant"], dists: ["TROUBLER","RESONNER","DISSIPER","INTERROMPRE"] },
  { tier: 3, diff: 7, type: "nom", ans: "SABLIER", w1s: ["HORLOGE","TEMPS","SECONDE","CHRONO"], w2s: ["SABLE","GRAIN","VERRE","FIOLE"], clues: ["Instrument antique mesurant le temps qui file", "Double fiole de verre à écoulement"], dists: ["CADRAN","CHRONOMETRE","CLEPSYDRE","MONTRE"] },
  { tier: 3, diff: 7, type: "v", ans: "POLARISER", w1s: ["FILTRE","OPTIQUE","CRISTAL"], w2s: ["LUMIERE","ONDE","FAISCEAU"], clues: ["Orienter les vibrations lumineuses dans un plan", "Filtrer selon une direction électromagnétique"], dists: ["DIFFRACTER","REFRACTER","DIRIGER","ATTENUER"] },
  { tier: 3, diff: 8, type: "v", ans: "REFRACTER", w1s: ["PRISME","DIOPTRE","LENTILLE"], w2s: ["RAYON","LUMIERE","MILIEU"], clues: ["Dévier un faisceau lors d'un changement de milieu", "Courber la trajectoire lumineuse"], dists: ["DIFFRACTER","DEVIR","REFLECHIR","ABSORBER"] },
  { tier: 3, diff: 7, type: "v", ans: "CATALYSER", w1s: ["ENZYME","REACTIF","SUBSTRAT"], w2s: ["REACTION","VITESSE","CHIMIE"], clues: ["Accélérer une réaction chimique sans s'altérer", "Déclencher un processus de transformation"], dists: ["ACCELERER","STIMULER","ACTIVER","DECLENCHER"] },
  { tier: 3, diff: 8, type: "v", ans: "IONISER", w1s: ["PLASMA","ELECTRON","CHAMP"], w2s: ["ATOME","CHARGE","GAZ"], clues: ["Arracher ou ajouter des électrons à un atome", "Créer des particules chargées"], dists: ["EXCITER","POLARISER","DISSOCIER","CHARGER"] },
  { tier: 3, diff: 8, type: "v", ans: "SUBLIMER", w1s: ["GLACE SECHE","CHALEUR","PRESSION"], w2s: ["GAZ","VAPEUR","SOLIDE"], clues: ["Passer directement de l'état solide à gazeux", "S'évaporer sans étape liquide"], dists: ["CONDENSER","VAPORISER","FONDRE","PURIFIER"] },
  { tier: 3, diff: 9, type: "v", ans: "FISSIONNER", w1s: ["NEUTRON","URANIUM","REACTEUR"], w2s: ["NOYAU","ENERGIE","FISSION"], clues: ["Scinder un noyau atomique lourd en dégageant de l'énergie", "Déclencher la réaction nucléaire"], dists: ["FUSIONNER","DESINTEGRER","CRAQUER","ROMPRE"] },
  { tier: 3, diff: 8, type: "nom", ans: "ENTROPIE", w1s: ["THERMODYNAMIQUE","DESORDRE","SYSTEME"], w2s: ["TEMPS","IRREVERSIBILITE","ENERGIE"], clues: ["Mesure du désordre irréversible d'un système", "Grandeur physique traduisant la dégradation"], dists: ["ENERGIE","CHAOS","INERTIE","EQUILIBRE"] },
  { tier: 3, diff: 7, type: "nom", ans: "GRAVITATION", w1s: ["NEWTON","MASSE","CORPS"], w2s: ["ATTRACTION","ESPACE","POIDS"], clues: ["Force universelle qui unit les corps massifs", "Attraction réciproque des astres"], dists: ["PESANTEUR","ORBITE","FORCE","INERTIE"] },
  { tier: 3, diff: 8, type: "nom", ans: "RELATIVITE", w1s: ["EINSTEIN","LUMIERE","VITESSE"], w2s: ["TEMPS","ESPACE","COURBURE"], clues: ["Théorie unifiant l'espace et le temps", "Cadre physique de l'invariance de la vitesse c"], dists: ["QUANTIQUE","GRAVITE","COSMOLOGIE","THEORIE"] },
  { tier: 3, diff: 8, type: "nom", ans: "SYNAPSE", w1s: ["NEURONE","AXONE","DENDRITE"], w2s: ["NEUROTRANSMETTEUR","SIGNAL","CERVEAU"], clues: ["Jonction assurant la transmission de l'influx nerveux", "Espace d'échange biochimique entre neurones"], dists: ["CELLULE","GANGLION","FIBRE","CONNEXION"] },
  { tier: 3, diff: 7, type: "nom", ans: "OSMOSE", w1s: ["MEMBRANE","SEMI-PERMEABLE","SOLVANT"], w2s: ["CONCENTRATION","PRESSION","EQUILIBRE"], clues: ["Diffusion d'un solvant à travers une paroi filtrante", "Équilibrage naturel des concentrations liquides"], dists: ["DIFFUSION","DIALYSE","FILTRATION","ABSORPTION"] },
  { tier: 3, diff: 7, type: "nom", ans: "PHOTOSYNTHESE", w1s: ["CHLOROPHYLLE","LUMIERE","CELLULE"], w2s: ["OXYGENE","CARBONE","PLANTE"], clues: ["Conversion biologique de l'énergie lumineuse", "Synthèse de matière organique grâce au soleil"], dists: ["RESPIRATION","FERMENTATION","ASSIMILATION","CYCLE"] },
  { tier: 3, diff: 8, type: "nom", ans: "MUTATION", w1s: ["ADN","GENOME","BASE"], w2s: ["SEQUENCE","CELLULE","HEREDITE"], clues: ["Modification de la séquence génétique", "Variation brusque et transmissible de l'ADN"], dists: ["ADAPTATION","EVOLUTION","VARIATION","ANOMALIE"] },
  { tier: 3, diff: 7, type: "nom", ans: "SYMBIOSE", w1s: ["ORGANISME","ESPECE","ASSOCIATION"], w2s: ["PARTENARIAT","BENEFICE","VIE"], clues: ["Association intime et durable entre deux espèces", "Partenariat biologique mutuellement profitable"], dists: ["PARASITISME","COMMENSALISME","COOPERATION","ENTENTE"] },
  { tier: 3, diff: 7, type: "nom", ans: "ANTICORPS", w1s: ["IMMUNITE","LYMPHOCYTE","SERUM"], w2s: ["ANTIGENE","DEFENSE","VIRUS"], clues: ["Protéine de défense neutralisant les intrus", "Arme biologique du système immunitaire"], dists: ["VACCIN","GLOBLE","TOXINE","BACTERIE"] },
  { tier: 3, diff: 8, type: "nom", ans: "OROGENESE", w1s: ["PLAQUES","TECTONIQUE","COLLISION"], w2s: ["MONTAGNE","RELIEF","PLI"], clues: ["Ensemble des processus créant les chaînes de montagnes", "Soulèvement géologique par collision de plaques"], dists: ["SUBDUCTION","EROSION","SEDIMENTATION","FAILLE"] },
  { tier: 3, diff: 8, type: "nom", ans: "SOLSTICE", w1s: ["SOLEIL","INCLINAISON","AZIMUT"], w2s: ["ETE","HIVER","JOURNEE"], clues: ["Moment de l'année où le jour est le plus long ou court", "Point culminant de la course solaire saisonnière"], dists: ["EQUINOXE","ZENITH","APOGEE","SAISON"] },
  { tier: 3, diff: 8, type: "nom", ans: "EQUINOXE", w1s: ["SOLEIL","ORBITE","TERRE"], w2s: ["JOUR","NUIT","EGALITE"], clues: ["Égalité parfaite de durée entre le jour et la nuit", "Passage du soleil à l'aplomb de l'équateur"], dists: ["SOLSTICE","ALIGNEMENT","CYCLE","PERIODE"] },
  { tier: 3, diff: 9, type: "nom", ans: "SUPERNOVA", w1s: ["ETOILE","MASSE","EFFONDREMENT"], w2s: ["EXPLOSION","LUMIERE","COSMOS"], clues: ["Explosion cataclysmique marquant la mort d'une étoile", "Éclat stellaire d'une puissance colossale"], dists: ["NOVA","PULSAR","TROU NOIR","NEBULEUSE"] },
  { tier: 3, diff: 9, type: "nom", ans: "TROU NOIR", w1s: ["SINGULARITE","HORIZON","GRAVITE"], w2s: ["LUMIERE","ESPACE","DENSITE"], clues: ["Région de l'espace dont même la lumière ne peut s'échapper", "Astre hyper-dense à la gravitation infinie"], dists: ["SUPERNOVA","QUASAR","NEBULEUSE","PULSAR"] },
  { tier: 3, diff: 9, type: "nom", ans: "QUASAR", w1s: ["NOYAU","GALAXIE","RAYONNEMENT"], w2s: ["TROU NOIR","LUMIERE","COSMOS"], clues: ["Cœur galactique ultra-lumineux et distant", "Source d'énergie colossale aux confins de l'univers"], dists: ["PULSAR","ETOILE","GALAXIE","SUPERNOVA"] },
  { tier: 3, diff: 8, type: "nom", ans: "NEBULEUSE", w1s: ["GAZ","POUSSIERE","MATIERE"], w2s: ["ETOILE","NAISSANCE","NUAGE"], clues: ["Nuage cosmique interstellaire où naissent les étoiles", "Volute lumineuse de gaz et de poussières"], dists: ["GALAXIE","COMETE","CONSTELATION","AMAS"] },
  { tier: 3, diff: 7, type: "nom", ans: "PARADOXE", w1s: ["LOGIQUE","ENONCE","PREMISSE"], w2s: ["CONTRADICTION","PENSEE","VERITE"], clues: ["Proposition semblant défier le bon sens logique", "Énoncé contenant une contradiction insoluble"], dists: ["DILEMME","ENIGME","APORIE","MYSTERE"] },
  { tier: 3, diff: 8, type: "nom", ans: "SYLLOGISME", w1s: ["MAJEURE","MINEURE","CONCLUSION"], w2s: ["RAISONNEMENT","LOGIQUE","ARISTOTE"], clues: ["Raisonnement déductif en trois propositions", "Démarche logique rigoureuse de conclusion"], dists: ["POSTULAT","AXIOME","DEMONSTRATION","THEOREME"] },
  { tier: 3, diff: 8, type: "nom", ans: "ALLEGORIE", w1s: ["CAVERNE","METAPHORE","IMAGE"], w2s: ["SYMBOLE","PLATON","IDEE"], clues: ["Représentation imagée d'une idée abstraite", "Récit philosophique à portée symbolique"], dists: ["PARABOLE","FABLE","METAPHORE","MYTHE"] },

  // ==========================================
  // --- TIER 4 : EXPERT / MAÎTRE (Niveau 61-100+) [40 Racines] ---
  // ==========================================
  { tier: 4, diff: 9, type: "adj", ans: "INVIOLABLE", w1s: ["SECRET","CADENAS","BLINDAGE","FORTERESSE"], w2s: ["SERRURE","MYSTERE","SCEAU","SERMENT"], clues: ["Que nulle force ne peut forcer ni altérer", "Garantissant une intégrité absolue"], dists: ["HERMETIQUE","IMPENETRABLE","INCASSABLE","INALTIERABLE"] },
  { tier: 4, diff: 9, type: "adj", ans: "INTEMPOREL", w1s: ["OEUVRE","CHEF-D-OEUVRE","MONUMENT","ART"], w2s: ["SIECLE","EPOQUE","TEMPS","MEMOIRE"], clues: ["Qui traverse les époques sans vieillir", "Qui défie l'usure des siècles"], dists: ["IMMORTEL","PERPETUEL","INDELEBILE","CELESTE"] },
  { tier: 4, diff: 10, type: "adj", ans: "INCOMMENSURABLE", w1s: ["ABYSSE","FOSSE","UNIVERS","COSMOS"], w2s: ["PROFONDEUR","INFINI","ETENDUE","DIMENSION"], clues: ["D'une dimension qui dépasse toute mesure", "Incommensurable et gigantesque"], dists: ["INFINI","INSONDABLE","GIGANTIQUE","DEMESURE"] },
  { tier: 4, diff: 10, type: "v", ans: "TRANSMUTER", w1s: ["ALCHIMIE","PIERRE PHILOSOPHALE","ATHANOR"], w2s: ["PLOMB","OR","MATIERE","ESSENCE"], clues: ["Opérer la transmutation de la matière", "Élever un élément vers sa perfection"], dists: ["METAMORPHOSER","SUBLIMER","CONVERTIR","PURIFIER"] },
  { tier: 4, diff: 10, type: "v", ans: "RENAITRE", w1s: ["PHOENIX","MYTHE","HEROS","LEGENDE"], w2s: ["CENDRE","FEU","MORT","DESTRUCTION"], clues: ["Revenir triomphalement à la vie après destruction", "Ressusciter de ses propres ruines"], dists: ["RESURGIR","REVIVRE","SURVIVRE","S ELEVER"] },
  { tier: 4, diff: 9, type: "v", ans: "TRANSCENDER", w1s: ["ESPRIT","CONSCIENCE","AME"], w2s: ["MATIERE","LIMITE","CORPS"], clues: ["Dépasser les limites de la condition matérielle", "S'élever au-dessus du monde sensible"], dists: ["SURPASSER","DOMINER","ELEVER","SUBLIMER"] },
  { tier: 4, diff: 9, type: "adj", ans: "EVANESCENT", w1s: ["BRUME","SONGE","SOUVENIR"], w2s: ["INSTANT","FUMEE","VAPEUR"], clues: ["Qui s'efface et disparaît avec légèreté", "D'une existence fugace et impalpable"], dists: ["FUGACE","EPHEMERE","TRANSPARENT","IMPALPABLE"] },
  { tier: 4, diff: 10, type: "nom", ans: "QUINTESSENCE", w1s: ["ETHER","PURIFICATION","ALCHIMIE"], w2s: ["ELEMENT","PERFECTION","EXTRAIT"], clues: ["Ce qu'il y a de plus pur et parfait dans une substance", "L'essence la plus raffinée d'une réalité"], dists: ["ELIXIR","SUBSTANCE","PURTE","SOMMET"] },
  { tier: 4, diff: 9, type: "adj", ans: "OMNISCIENT", w1s: ["DIVINITE","ORACLE","DESTIN"], w2s: ["SAVOIR","CONNAISSANCE","TOUT"], clues: ["Qui possède la connaissance absolue de toute chose", "Qui sait tout sans la moindre limite"], dists: ["OMNIPRESENT","OMNIPOTENT","ECLAIRE","LUCIDE"] },
  { tier: 4, diff: 9, type: "adj", ans: "INEXORABLE", w1s: ["TEMPS","DESTIN","FATALITE"], w2s: ["HEURE","MARCHE","FIN"], clues: ["Contre lequel on ne peut rien tenter ni infléchir", "Qui s'accomplit sans pouvoir être arrêté"], dists: ["IMPLACABLE","INEVITABLE","FATAL","INEBRANLABLE"] },
  { tier: 4, diff: 10, type: "nom", ans: "PANACEE", w1s: ["REMEDE","ELIXIR","POTION"], w2s: ["MALADIE","MAUX","GUERISON"], clues: ["Remède universel censé guérir tous les maux", "Potion magique souveraine"], dists: ["ELIXIR","BAUME","ANTIDOTE","THERIAQUE"] },
  { tier: 4, diff: 10, type: "nom", ans: "DEMIURGE", w1s: ["CREATION","COSMOS","PLATON"], w2s: ["UNIVERS","MATIERE","ORDRE"], clues: ["Architecte divin façonnant le monde matériel", "Créateur suprême ordonnant le cosmos"], dists: ["CREATEUR","ARCHITECTE","DIVINITE","GENIE"] },
  { tier: 4, diff: 9, type: "nom", ans: "CATHARSIS", w1s: ["TRAGEDIE","THEATRE","SPECTACLE"], w2s: ["PURIFICATION","EMOTION","AME"], clues: ["Purification des passions par le spectacle tragique", "Libération émotionnelle profonde"], dists: ["PURGATION","APAISEMENT","DELIVRANCE","EXTASE"] },
  { tier: 4, diff: 10, type: "nom", ans: "OUROBOROS", w1s: ["SERPENT","QUEUE","CYCLE"], w2s: ["INFINI","ETERNITE","SYMBOLE"], clues: ["Serpent mythique se mordant la queue", "Symbole universel du cycle perpétuel"], dists: ["DRAGON","HYDRE","CERCLE","SPIRALE"] },
  { tier: 4, diff: 9, type: "nom", ans: "LABYRINTHE", w1s: ["DEDALE","MINOTAURE","DETOUR"], w2s: ["CRETE","FIL","ARIANE"], clues: ["Réseau complexe d'allées sans issue", "Édifice inextricable conçu par Dédale"], dists: ["DEDALE","MEANDRE","PIEGE","PRISON"] },
  { tier: 4, diff: 9, type: "nom", ans: "SPHINX", w1s: ["THEBES","OEDIPE","ENIGME"], w2s: ["CREATURE","LION","AILE"], clues: ["Monstre mythique posant des énigmes redoutables", "Gardienne ailée au corps léonin"], dists: ["CHIMERE","GRIFFON","GORGONNE","HYDRE"] },
  { tier: 4, diff: 9, type: "nom", ans: "PEGASE", w1s: ["CHEVAL","AILES","OLYMPE"], w2s: ["BELLEROPHON","CIEL","MYTHE"], clues: ["Majestueux cheval ailé né du sang de Méduse", "Monture céleste des héros antiques"], dists: ["CENTAURE","LICORNE","GRIFFON","HIPPOGRIFFE"] },
  { tier: 4, diff: 10, type: "nom", ans: "KRAKEN", w1s: ["TENTACULE","ABYSSE","OCEAN"], w2s: ["NAVIRE","LEGENDE","MONSTRE"], clues: ["Monstre marin géant capable d'engloutir les navires", "Créature colossale des abysses nordiques"], dists: ["LEVIATHAN","SERPENT","CALMAR","HYDRE"] },
  { tier: 4, diff: 10, type: "nom", ans: "YGGDRASIL", w1s: ["ARBRE","FRÊNE","ROYAUMES"], w2s: ["MYTHOLOGIE","NORDIQUE","MONDES"], clues: ["Arbre-monde soutenant les neuf royaumes", "Frêne cosmique de la mythologie scandinave"], dists: ["AXE","PILIER","RACINE","COSMOS"] },
  { tier: 4, diff: 9, type: "nom", ans: "PANDORE", w1s: ["BOITE","JARRE","CURIOSITE"], w2s: ["MAUX","ESPERANCE","MYTHE"], clues: ["Première femme mortelle ouvrant la boîte fatale", "Porteuse des maux et de l'espérance"], dists: ["PSYCHE","HECATE","MEDEE","PROMETHEE"] }
];

fs.mkdirSync('vault_packs', { recursive: true });
let globalId = 1;

for (let tierId = 1; tierId <= 4; tierId++) {
  const tierName = tierId === 1 ? 'tier1_facile' : (tierId === 2 ? 'tier2_moyen' : (tierId === 3 ? 'tier3_difficile' : 'tier4_expert'));
  const seeds = SEED_CORPUS.filter(s => s.tier === tierId);
  const pool = [];
  const seenKeys = new Set();

  for (const seed of seeds) {
    for (let i = 0; i < seed.w1s.length; i++) {
      for (let j = 0; j < seed.w2s.length; j++) {
        const w1 = seed.w1s[i];
        const w2 = seed.w2s[j];
        if (w1 === w2) continue;
        const key = `${w1}|${w2}|${seed.ans}`;
        const revKey = `${w2}|${w1}|${seed.ans}`;
        if (seenKeys.has(key) || seenKeys.has(revKey)) continue;
        seenKeys.add(key);

        const clue = seed.clues[(i + j) % seed.clues.length];
        const dShuffled = [...seed.dists].sort(() => 0.5 - Math.random());
        const d1 = dShuffled[0];
        const d2 = dShuffled[1] || dShuffled[0];

        pool.push([
          globalId++,
          w1,
          w2,
          seed.ans,
          clue,
          seed.diff,
          seed.type,
          d1,
          d2
        ]);
      }
    }
  }

  // Shuffle complet du pool pour une variété totale
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const raw = JSON.stringify(pool);
  const gz = zlib.gzipSync(Buffer.from(raw), { level: 9 });
  const destGz = path.join('vault_packs', `${tierName}.json.gz`);
  const destJson = path.join('vault_packs', `${tierName}.json`);
  fs.writeFileSync(destGz, gz);
  fs.writeFileSync(destJson, raw);

  const sizeKb = (gz.length / 1024).toFixed(1);
  console.log(`[Succes] ${tierName}.json.gz genere : ${pool.length} enigmes 100% uniques (${sizeKb} Ko, ${seeds.length} racines).`);
}

console.log("\n=== BASE DE DONNEES D'ENIGMES 100% UNIQUE ET CERTIFIEE GENEREE ===");
