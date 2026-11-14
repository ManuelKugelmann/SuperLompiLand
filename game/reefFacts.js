// More to read in the reef book's detail view (pure, no Phaser): further true, kid-friendly facts per
// entry, shown under the entry's first fact (game/reefbook.js). Keyed by entry id; an entry without
// more facts simply shows its one.

const f = (de, en) => ({ de, en });

export const MORE_FACTS = {
    // Places (2026-11-15): every place gets more than its one fact, like the animals.
    front: [
        f("Seevögel und Delfine kommen zu solchen Linien, weil sich dort viele kleine Fische sammeln.", "Seabirds and dolphins come to such lines because many small fish gather there."),
        f("Man erkennt eine Front oft an einem Streifen aus Schaum und an zwei verschiedenen Wasserfarben.", "You can often spot a front by a strip of foam and two different colours of water.")],
    nursery: [
        f("Die Wurzeln bremsen das Wasser. Dadurch bleibt Schlamm liegen, und darin wächst viel Futter.", "The roots slow the water down. Mud settles there, and lots of food grows in it."),
        f("Junge Zitronenhaie bleiben ein paar Jahre in den Mangroven, bevor sie ins offene Meer ziehen.", "Young lemon sharks stay in the mangroves for a few years before they head out to the open sea.")],
    ferry: [
        f("Schiffsschrauben sind laut. Unter Wasser trägt der Schall viel weiter als in der Luft.", "Ship propellers are loud. Under water sound travels much further than in air."),
        f("Langsamere Schiffe sind leiser und treffen seltener Wale und Schildkröten.", "Slower ships are quieter and hit whales and turtles less often.")],
    surge_channel: [
        f("Tiere in der Brandung halten sich gut fest: Seepocken kleben, Muscheln spinnen Fäden.", "Animals in the surf hold on tight: barnacles glue themselves down and mussels spin threads."),
        f("Das schäumende Wasser bringt viel Sauerstoff und Futter mit.", "The foaming water brings lots of oxygen and food.")],
    jelly_garden: [
        f("Auf Englisch heißen sie Kopfüber-Quallen.", "In English they are called upside-down jellyfish."),
        f("Sie pumpen sanft mit ihrem Schirm, damit frisches Wasser zu ihren Algen kommt.", "They pump gently with their bell so fresh water reaches their algae.")],
    vent_field: [
        f("Das Wasser an einem Schlot kann über 350 Grad heiß sein. Der hohe Druck lässt es nicht kochen.", "The water at a vent can be hotter than 350 degrees. The great pressure keeps it from boiling."),
        f("Die Röhrenwürmer haben keinen Mund. Bakterien in ihrem Körper machen das Futter für sie.", "The tube worms have no mouth. Bacteria inside their body make their food for them.")],
    cleaner_station: [
        f("Putzerfische tanzen auf und ab, damit die großen Fische wissen: Hier wird geputzt.", "Cleaner fish dance up and down so the big fish know: cleaning happens here."),
        f("Sogar Haie und Mantas kommen zur Putzerstation und halten ganz still.", "Even sharks and mantas come to the cleaning station and keep very still.")],
    coral_colony: [
        f("Korallen wachsen nur wenige Zentimeter im Jahr.", "Corals grow only a few centimetres a year."),
        f("Nachts strecken die kleinen Korallentiere ihre Fangarme aus und fangen Plankton.", "At night the tiny coral animals stretch out their arms and catch plankton.")],
    sandbar: [
        f("Eine Sandbank wandert langsam mit den Strömungen und sieht jedes Jahr ein bisschen anders aus.", "A sandbar slowly moves with the currents and looks a little different every year."),
        f("Im Sand darunter leben Muscheln, Würmer und Krebse, die man kaum sieht.", "Clams, worms and crabs you hardly ever see live in the sand below.")],
    sargassum: [
        f("Nach diesem Tang ist sogar ein ganzes Meer benannt: die Sargassosee.", "A whole sea is named after this seaweed: the Sargasso Sea."),
        f("Der Sargassofisch sieht genau aus wie der Tang und versteckt sich darin.", "The sargassum fish looks just like the seaweed and hides in it.")],
    sea_arch: [
        f("Sand und Steine in den Wellen schleifen den Fels wie Schmirgelpapier.", "Sand and stones in the waves grind the rock like sandpaper."),
        f("Unter dem Felsentor ist das Wasser oft voller Fische, die im Schatten stehen.", "Under the arch the water is often full of fish resting in the shade.")],
    ghost_ship: [
        f("Holz wird im Meer von Bohrmuscheln langsam aufgefressen. Metall rostet über viele Jahre.", "In the sea wood is slowly eaten by shipworms. Metal rusts away over many years."),
        f("Für viele Fische ist ein Wrack wie ein großes Haus mit vielen Zimmern zum Verstecken.", "For many fish a wreck is like a big house with many rooms to hide in.")],
    beach: [
        f("Meeresschildkröten graben ihre Nester in den warmen Sand am Strand.", "Sea turtles dig their nests in the warm sand of the beach."),
        f("Mit jeder Welle bringen Strömungen neuen Sand und nehmen alten mit.", "With every wave, currents bring new sand and take old sand away.")],
    reef: [
        f("Riffe sind nur ein winziger Teil des Meeres, aber ein Viertel aller Meerestiere lebt dort.", "Reefs are only a tiny part of the sea, but a quarter of all sea animals live there."),
        f("Korallen brauchen klares, warmes Wasser und viel Licht.", "Corals need clear, warm water and lots of light.")],
    mangrove: [
        f("Mangroven können in Salzwasser wachsen. Überschüssiges Salz scheiden sie über die Blätter aus.", "Mangroves can grow in salt water. They get rid of the extra salt through their leaves."),
        f("Ihre Wurzeln schützen die Küste vor Sturmwellen.", "Their roots protect the coast from storm waves.")],
    kelp: [
        f("Tang hat keine Wurzeln. Er hält sich mit einem Haftfuß am Fels fest.", "Kelp has no roots. It holds on to the rock with a holdfast."),
        f("Kleine Gasblasen an den Blättern halten den Tang aufrecht, zum Licht hin.", "Little gas bladders on the blades keep the kelp standing up, towards the light.")],
    blue: [
        f("Im offenen Meer gibt es nichts zum Verstecken. Darum sind viele Fische hier silbern und schwimmen in Schwärmen.", "In the open sea there is nowhere to hide. That is why many fish here are silver and swim in shoals."),
        f("Winzige Algen im Meer machen mehr als die Hälfte des Sauerstoffs, den wir atmen.", "Tiny algae in the sea make more than half of the oxygen we breathe.")],
    wreck: [
        f("Manche Wracks werden absichtlich versenkt, damit dort ein neues Riff wachsen kann.", "Some wrecks are sunk on purpose so a new reef can grow there."),
        f("In der Tiefe ist es kalt und dunkel. Dort bleiben Wracks oft sehr lange erhalten.", "Deep down it is cold and dark. Wrecks often last a very long time there.")],
    shore: [
        f("In Felstümpeln bleibt bei Ebbe Wasser stehen: kleine Aquarien voller Tiere.", "At low tide water stays behind in rock pools: little aquariums full of animals."),
        f("Seehunde ruhen sich gern auf Felsen in der Sonne aus.", "Seals like to rest on rocks in the sun.")],
    harbour: [
        f("An Hafenpfählen wachsen so viele Muscheln, dass sie wie ein Pelz aussehen.", "So many mussels grow on harbour piles that they look like fur."),
        f("Was hilft: Müll gehört in die Tonne, dann treibt er nicht ins Hafenbecken.", "What helps: rubbish goes in the bin, so it does not drift into the harbour.")],
    trench: [
        f("Ganz unten drückt das Wasser so stark wie ein Elefant auf einem Daumennagel.", "At the very bottom the water presses as hard as an elephant standing on a thumbnail."),
        f("Auch dort unten leben Tiere: kleine Flohkrebse und durchsichtige Fische.", "Even down there animals live: little amphipods and see-through fish.")],
    friend_turtle: [
        f('Zum Eierlegen schwimmt sie zurück an den Strand, an dem sie selbst geschlüpft ist.', 'To lay her eggs she swims back to the beach where she hatched herself.'),
        f('Meeresschildkröten können über 50 Jahre alt werden.', 'Sea turtles can live for more than 50 years.')],
    friend_jellyfish: [
        f('Quallen gab es schon lange vor den Dinosauriern.', 'There were jellyfish long before the dinosaurs.'),
        f('Mit ihren Tentakeln fangen sie winzige Tiere aus dem Wasser.', 'They catch tiny animals from the water with their tentacles.')],
    friend_seahorse: [
        f('Mit dem Schwanz hält es sich am Seegras fest, damit die Strömung es nicht mitnimmt.', 'It holds on to seagrass with its tail so the current does not carry it off.'),
        f('Seine Augen können in zwei Richtungen gleichzeitig schauen.', 'Its eyes can look in two directions at once.')],
    friend_starfish: [
        f('An der Spitze jedes Arms sitzt ein winziges Auge.', 'There is a tiny eye at the tip of each arm.'),
        f('Seesterne haben kein Blut. Sie pumpen Meerwasser durch ihren Körper.', 'Starfish have no blood. They pump seawater through their body.')],
    friend_nudibranch: [
        f('Ihre Kiemen trägt sie offen auf dem Rücken, wie ein kleines Blumensträußchen.', 'It carries its gills in the open on its back, like a little bunch of flowers.'),
        f('Mit den zwei Fühlern am Kopf riecht sie ihr Futter.', 'It smells its food with the two feelers on its head.')],
    friend_parrotfish: [
        f('Sein Maul ist hart wie ein Schnabel, daher der Name.', 'Its mouth is as hard as a beak, hence the name.'),
        f('Manche Papageifische schlafen nachts in einer Hülle aus Schleim.', 'Some parrotfish sleep at night inside a cover of slime.')],
    giant_clam: [
        f('In ihrem bunten Mantel wohnen winzige Algen, die aus Sonnenlicht Nahrung machen.', 'Tiny algae live in its colourful mantle and make food from sunlight.'),
        f('Hat sie einmal ihren Platz gefunden, bleibt sie dort ihr Leben lang.', 'Once it has found its place it stays there for life.')],
    hermit_crab: [
        f('Wird das Haus zu eng, zieht er in ein größeres um.', 'When its home gets too tight it moves into a bigger one.'),
        f('Sein Hinterleib ist ganz weich, deshalb braucht er den Schutz.', 'Its back end is quite soft, which is why it needs the shelter.')],
    garden_eel: [
        f('Sie stehen alle mit dem Gesicht zur Strömung, die ihnen das Futter bringt.', 'They all face the current, which brings them their food.'),
        f('Viele wohnen dicht beieinander, wie Halme in einem Garten.', 'Many live close together, like stalks in a garden.')],
    sand_ray: [
        f('Im Sand atmet er durch zwei Löcher hinter den Augen.', 'In the sand it breathes through two holes behind its eyes.'),
        f('Sein Skelett ist aus biegsamem Knorpel, wie deine Nasenspitze.', 'Its skeleton is made of bendy cartilage, like the tip of your nose.')],
    whale_shark: [
        f('Er wird so lang wie ein Bus.', 'It grows as long as a bus.'),
        f('Jeder Walhai hat sein eigenes Punktemuster, wie ein Fingerabdruck.', 'Every whale shark has its own pattern of spots, like a fingerprint.')],
    siphonophore: [
        f('Jedes der kleinen Tiere hat eine Aufgabe: schwimmen, fangen oder fressen.', 'Each of the little animals has a job: swimming, catching or eating.'),
        f('Viele Staatsquallen leuchten im Dunkeln.', 'Many siphonophores glow in the dark.')],
    sea_lion: [
        f('Seelöwen haben kleine Ohrmuscheln. Daran erkennst du sie.', 'Sea lions have small ear flaps. That is how you can tell them.'),
        f('An Land laufen sie auf allen vier Flossen.', 'On land they walk on all four flippers.')],
    sea_otter: [
        f('Kein Tier hat ein dichteres Fell als der Seeotter.', 'No animal has thicker fur than the sea otter.'),
        f('Sein Lieblingswerkzeug, einen Stein, trägt er in einer Hautfalte unter dem Arm.', 'It keeps its favourite tool, a stone, in a fold of skin under its arm.')],
    seal: [
        f('Mit seinen Barthaaren spürt er Fische auch im trüben Wasser.', 'With its whiskers it feels fish even in murky water.'),
        f('Seehunde haben keine Ohrmuscheln, nur kleine Ohrlöcher.', 'Harbour seals have no ear flaps, only small ear holes.')],
    adult_shark: [
        f('Einem Hai wachsen sein Leben lang neue Zähne nach.', 'A shark grows new teeth all its life.'),
        f('Haie spüren die winzigen elektrischen Signale anderer Tiere.', 'Sharks can sense the tiny electric signals of other animals.')],
    manta: [
        f('Von Flügelspitze zu Flügelspitze kann er sieben Meter messen.', 'From wing tip to wing tip it can measure seven metres.'),
        f('Mantas fressen Plankton und haben keinen Stachel.', 'Mantas eat plankton and have no sting.')],
    urchin: [
        f('Sein Mund sitzt unten und hat fünf Zähne.', 'Its mouth is underneath and has five teeth.'),
        f('Seeigel raspeln Algen von den Felsen.', 'Sea urchins scrape algae off the rocks.')],
    enemy_angler: [
        f('In der Tiefsee ist es stockdunkel. Sein Licht lockt neugierige Fische an.', 'It is pitch dark in the deep sea. Its light lures curious fish.'),
        f('Sein Maul ist so groß, dass er Beute schlucken kann, die so groß ist wie er selbst.', 'Its mouth is so big that it can swallow prey as large as itself.')],
    school_anthias: [
        f('Sie bleiben dicht am Riff und flitzen bei Gefahr in die Korallen.', 'They stay close to the reef and dart into the corals when danger comes.'),
        f('Sie schnappen Plankton aus der Strömung.', 'They snap plankton out of the current.')],
    school_tang: [
        f('Doktorfische fressen Algen und halten so das Riff sauber.', 'Tangs eat algae and so keep the reef clean.'),
        f('Nachts wird ihr Gelb etwas blasser.', 'At night their yellow gets a little paler.')],
    school_juvenile: [
        f('Viele Jungfische sehen ganz anders aus als ihre Eltern.', 'Many young fish look quite different from their parents.'),
        f('Zwischen Wurzeln und Seegras finden sie Verstecke und Futter.', 'Between roots and seagrass they find hiding places and food.')],
    school_fry: [
        f('Die meisten Fische schlüpfen aus Eiern, die kleiner sind als ein Stecknadelkopf.', 'Most fish hatch from eggs smaller than a pinhead.'),
        f('Nur wenige von ihnen werden erwachsen. Darum sind es so viele.', 'Only a few of them grow up. That is why there are so many.')],
    school_silverside: [
        f('Ihre silbernen Seiten spiegeln das Licht wie kleine Spiegel.', 'Their silver sides reflect the light like little mirrors.'),
        f('Jeder Fisch achtet nur auf seine Nachbarn. So entsteht der Schwarm.', 'Each fish only watches its neighbours. That is how the shoal forms.')],
    school_lantern: [
        f('Jede Nacht steigen sie aus der Tiefe nach oben, um zu fressen.', 'Every night they rise from the deep to feed.'),
        f('Es gibt mehr Laternenfische als fast jede andere Fischart.', 'There are more lanternfish than almost any other kind of fish.')],
    whale: [
        f('Buckelwale fangen Fische mit einem Netz aus Luftblasen.', 'Humpback whales catch fish with a net of bubbles.'),
        f('Jeder hat ein eigenes Muster unter der Schwanzflosse.', 'Each one has its own pattern under its tail fluke.')],
    gannet: [
        f('Luftpolster unter der Haut dämpfen den Aufprall aufs Wasser.', 'Air cushions under its skin soften the impact on the water.'),
        f('Unter Wasser schwimmt er mit den Flügeln weiter.', 'Under water it swims on with its wings.')],
    glow_jelly: [
        f('Ein plötzliches Aufleuchten kann Angreifer erschrecken.', 'A sudden flash can startle attackers.'),
        f('Das Leuchten entsteht ganz ohne Wärme.', 'The glow is made without any heat.')],
    octopus: [
        f('Ein Krake hat drei Herzen und blaues Blut.', 'An octopus has three hearts and blue blood.'),
        f('Er hat keine Knochen und passt durch winzige Spalten.', 'It has no bones and fits through tiny gaps.')],
    dolphin: [
        f('Jeder Delfin hat seinen eigenen Pfiff, wie einen Namen.', 'Every dolphin has its own whistle, like a name.'),
        f('Beim Schlafen ruht immer nur eine Hälfte seines Gehirns.', 'When it sleeps, only one half of its brain rests at a time.')],
    barracuda: [
        f('Alles, was glitzert, macht ihn neugierig, weil es wie ein silberner Fisch aussieht.', 'Anything that glitters makes it curious, because it looks like a silver fish.'),
        f('Hinter Felsen und Korallen verliert er seine Beute schnell aus den Augen.', 'Behind rocks and corals it soon loses sight of its prey.')],
    dugong: [
        f('Seine nächsten Verwandten an Land sind die Elefanten.', 'Its closest relatives on land are the elephants.'),
        f('Wo ein Dugong gegrast hat, bleibt eine Spur im Seegras.', 'Where a dugong has grazed it leaves a trail in the seagrass.')],
    dumbo_octopus: [
        f('Seine Beute schluckt er im Ganzen.', 'It swallows its prey whole.'),
        f('Er hat keinen Tintenbeutel. Im Dunkeln nützt Tinte nichts.', 'It has no ink sac. Ink is no use in the dark.')],
    nudibranchs: [
        f('Es gibt mehr als 3000 Arten, jede mit eigenem Muster.', 'There are more than 3000 kinds, each with its own pattern.'),
        f('Sie sind Schnecken, die ihr Haus abgelegt haben.', 'They are snails that gave up their shell.')],
    garden_eels: [
        f('Ihr Loch kleiden sie mit Schleim aus, damit der Sand hält.', 'They line their hole with slime so the sand holds.'),
        f('Rückwärts geht es am schnellsten: Schwanz voran in den Bau.', 'Backwards is fastest: tail first into the burrow.')],
    stingray: [
        f('Sein Maul sitzt unten. So saugt er Muscheln und Krebse aus dem Sand.', 'Its mouth is underneath. That is how it sucks clams and crabs out of the sand.'),
        f('Der Stachel am Schwanz dient nur zur Verteidigung.', 'The sting on its tail is only for defence.')],
    archerfish: [
        f('Beim Zielen rechnet er mit ein, dass das Wasser den Blick knickt.', 'When it aims it allows for the way water bends the view.'),
        f('Junge Schützenfische müssen das Treffen erst üben.', 'Young archerfish have to practise hitting first.')],
    container_field: [
        f('Was hilft: Ladung gut sichern und Stürmen ausweichen.', 'What helps: securing cargo well and steering round storms.')],
    hazard_net: [
        f('Was hilft: Taucher bergen Geisternetze, und daraus werden neue Dinge gemacht.', 'What helps: divers bring ghost nets up, and new things are made from them.')],
    hazard_buoy: [
        f('Was hilft: Helfer waschen verölte Vögel vorsichtig mit Seife sauber.', 'What helps: helpers gently wash oiled birds clean with soap.')],
    mine: [
        f('Was hilft: feste Bojen zum Festmachen, dann muss niemand ankern.', 'What helps: fixed mooring buoys, so that nobody has to drop anchor.')],
    spikes: [
        f('Auf altem Schrott siedeln mit der Zeit Schwämme und Korallen.', 'In time sponges and corals settle on old scrap.')]
};

/** All facts of an entry, the first one first. */
export const factsOf = e => [e.fact, ...(MORE_FACTS[e.id] || [])];
