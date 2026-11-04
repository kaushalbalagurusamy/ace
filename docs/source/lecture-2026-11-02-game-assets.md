# Game Assets — Matt Hulme, Gauntlet (2026-11-02)

Source: https://game-assets-gauntlet.vercel.app/ (slide deck; text extracted from its data.js, images/video not included). 76 slides.

## 1. GAME ASSETS  _(OPENING)_

Visuals and sound for
the game you’re building.
MATT HULME
GAUNTLET · NOVEMBER 02, 2026
PRESS START →
[image: QuizCaster sprite collection: characters, spells, enemies, outfits and terrain]QuizCaster sprites · Matt Hulme & Jason

## 2. QuizCaster  _(QUIZCASTER)_

Original QuizCaster devlog footage · 21-second montage · silent
[Open QuizCaster ↗](https://quizcaster.com)[Earlier build talk ↗](https://gauntletai.com/night-school/how-to-build-a-game-with-ai)

## 3. Don't Be This Guy  _(QUIZCASTER)_

ToadBurger · 44 seconds · [Original video ↗](https://www.youtube.com/watch?v=mcYl70vq_Ns)

## 4. The asset set  _(QUIZCASTER)_

[image: Original QuizCaster overview with weapons, spell effects, enemies, outfits, props, and terrain sprites]

## 5. What goes into one screen  _(INSIDE QUIZCASTER)_

[image: QuizCaster gameplay with characters, enemy crowds, spell effects, a shop, terrain and HUD]1234561CharactersDirections and walk cycles

2EnemiesDifferent bodies and attacks

3SpellsProjectiles, blasts and beams

4World objectsShops and pickups

5InterfaceSpell slots, score and minimap

6The worldTiles, paths and prop placement

## 6. One character, eight directions  _(INSIDE QUIZCASTER)_

North
Northeast
East
Southeast
South
Southwest
West
Northwest

Five drawn views. West-facing directions reuse mirrored art.

## 7. Spells, summons and status effects  _(INSIDE QUIZCASTER)_

Projectiles
Area blasts
Ice effects
Lingering hazards
[image: Lightning arc][image: Void core]
Lightning and void
[image: Arcane sentry][image: Frost sentry][image: Tesla coil]
Summoned objects

## 8. The world is a kit of parts  _(INSIDE QUIZCASTER)_

[image: Ground tiles and path edges][image: Ground tiles and path edges][image: Ground tiles and path edges][image: Ground tiles and path edges][image: Ground tiles and path edges]
Ground tiles and path edges
[image: Scenery][image: Scenery][image: Scenery][image: Scenery]
Scenery
[image: Interactive objects][image: Interactive objects][image: Interactive objects][image: Interactive objects]
Interactive objects

[image: QuizCaster world assembled from tiles and scenery]Code chooses the layout and places the art.
[image: Upgrade card frame][image: Wisdom upgrade icon]Card art + icons + code-built UI

## 9. Outfits are another asset family  _(INSIDE QUIZCASTER)_

Frost
Ember
Arcane
Venom
Void

Body, clothing and hats have to line up
across directions and animation frames.
Our cosmetics work mixed PixelLab art,
Aseprite edits and code-made variants.

## 10. Where the pieces came from  _(INSIDE QUIZCASTER)_

PixelLab art
[image: PixelLab frost bolt sprite][image: PixelLab golden quest mushroom]
Character views
Spell sprites and animation
Generated pickup art

Made with code
Ricochet beam paths
HUD bars and feedback
World layout and weather

Existing tools
PhaserGame rendering and interaction
jsfxrSound-effect generation
AsepritePixel edits and sprite export

Creator → separate critic → fixes → in-game check
[Game breakdown ↗](quizcaster-asset-breakdown.md)[Workflow details ↗](qc-pipeline-guide.md)[Starter skills ↗](starter-skills/README.md)

## 11. 2D and 3D  _(CHOOSING A PATH)_

[image: QuizCaster top-down 2D view]QuizCaster
2D
Direct control over the final image.
Extra views and actions need more frames.

[image: Pastel Nuketown 3D solo gameplay]Pastel Nuketown
3D
Reuse a model across camera angles.
Budget for materials, lighting, and rigs.

## 12. Game engines  _(CHOOSING A PATH)_

[image: QuizCaster browser game]Browser
Phaser for 2D.
Three.js for 3D rendering.
[image: Godot editor]Godot
2D and 3D.
Scenes and nodes.
[image: Unity editor]Unity
2D and 3D.
Components and C#.
[image: Actual Unreal Editor interface]Unreal
Integrated 3D tools.
Blueprints and C++.

## 13. Inside-out development  _(CHOOSING A PATH)_

PresentationFeedbackPlayable loopCore action

Prototype the interaction the game depends on.
For a platformer, tune the jump with simple shapes before making a full asset set.
A small playable slice gives each new asset a place to be tested.

Art direction and small asset tests can run alongside the gameplay prototype.

## 14. Greyboxing in 2D  _(CHOOSING A PATH)_

[image: Prepared collision blockout of a platformer level with ground, gaps, platforms and ladders]Collision blockout
[image: Kenney pixel platformer scene with a side-view character, grassy terrain, tree, platforms and hazards]Tile art · Kenney Pixel Platformer

Test jumps and gaps with simple collision shapes. Add tile art around that layout.

## 15. Greyboxing in 3D  _(CHOOSING A PATH)_

[image: Docks level blockout compared with final art]Brian Baker · Docks, Call of Duty: Modern Warfare (2019) · via The Level Design Book

## 16. Visual assets  _(VISUAL ASSETS)_

Art direction, still images, animation and 3D models.

## 17. Visual asset types  _(VISUAL ASSETS)_

[image: Reference images example]Reference images
Art direction before production
[image: Characters example]Characters
Who moves through the game
[image: Props & pickups example]Props & pickups
Objects players use or collect
[image: Environments example]Environments
The spaces players explore
♥ ♥ ♥　024 ◆PAUSEDResume　→
UI & typography
HUD, menus and readable text
[image: Textures & materials example]Textures & materials
Surface detail and appearance
[image: Lighting example]Lighting
Visibility, shadows and mood
[image: Animation & VFX example]Animation & VFX
Movement and effects

## 18. Common game art styles  _(ART DIRECTION)_

Pixel art / 2D

Outlined / vector-like 2D

Hand-painted / 2D

Low-poly / 3D

Stylized / 3D

Realistic / PBR 3D

Choose a visual direction before generating a cast or a world.

## 19. Pixel art / 2D  _(ART DIRECTION)_

Generated example
[image: Actual output of the saved Pixel art / 2D prompt]OpenAI native image generation
Exact style wording
Use coherent crisp 16-bit pixel art throughout, with strong hard pixel clusters and no smooth antialiasing.
The full prompt also specifies the subjects and layout.
FULL PROMPT + RESULT ↗COPY FULL PROMPT
[All actual prompts ↓](art-style-guide.md)

## 20. Outlined / vector-like 2D  _(ART DIRECTION)_

Generated example
[image: Actual output of the saved Outlined / vector-like 2D prompt]OpenAI native image generation
Exact style wording
Use coherent flat geometric vector-like 2D illustration throughout, with clean thick outlines, simple shapes, and flat colors.
The full prompt also specifies the subjects and layout.
FULL PROMPT + RESULT ↗COPY FULL PROMPT
[All actual prompts ↓](art-style-guide.md)

## 21. Hand-painted / 2D  _(ART DIRECTION)_

Generated example
[image: Actual output of the saved Hand-painted / 2D prompt]OpenAI native image generation
Exact style wording
Use coherent hand-painted 2D game illustration throughout with visible broad brush edges and soft texturing.
The full prompt also specifies the subjects and layout.
FULL PROMPT + RESULT ↗COPY FULL PROMPT
[All actual prompts ↓](art-style-guide.md)

## 22. Low-poly / 3D  _(ART DIRECTION)_

Generated example
[image: Actual output of the saved Low-poly / 3D prompt]OpenAI native image generation
Exact style wording
Cohesive low-poly 3D aesthetic: faceted flat-shaded simple geometry, clean readable silhouette, warm restrained colors.
The full prompt also specifies the subjects and layout.
FULL PROMPT + RESULT ↗COPY FULL PROMPT
[All actual prompts ↓](art-style-guide.md)

## 23. Stylized / 3D  _(ART DIRECTION)_

Generated example
[image: Actual output of the saved Stylized / 3D prompt]OpenAI native image generation
Exact style wording
Cohesive stylized 3D aesthetic: rounded readable shapes, bevels, simplified materials, warm restrained colors.
The full prompt also specifies the subjects and layout.
FULL PROMPT + RESULT ↗COPY FULL PROMPT
[All actual prompts ↓](art-style-guide.md)

## 24. Realistic / PBR 3D  _(ART DIRECTION)_

Generated example
[image: Actual output of the saved Realistic / PBR 3D prompt]OpenAI native image generation
Exact style wording
Cohesive realistic PBR 3D aesthetic: plausible worn wood, metal and cloth, rich material texture, natural cinematic lighting, detailed but readable.
The full prompt also specifies the subjects and layout.
FULL PROMPT + RESULT ↗COPY FULL PROMPT
[All actual prompts ↓](art-style-guide.md)

## 25. Visual coherence  _(ART DIRECTION)_

Coherent set
[image: Matching generated character, environment and objects]Shared palette, edges, scale, and detail.
Mixed styles

Good individual images can still clash.

## 26. Three ways to get visual assets  _(VISUAL ASSET OVERVIEW)_

1AI generation
[image: PixelLab dragon sprite example]Describe what you want or give a reference. A service returns images, sprites or models.
PixelLab · Retro Diffusion · Meshy

  2Made with code
The agent writes code that draws shapes, particle effects and materials (also called procedural).
This coin is a few lines of SVG

  3Asset libraries
[image: Kenney Tiny Dungeon pack preview]Packs and models that artists have already made.
Kenney · Poly Haven · itch.io

## 27. From reference to animation  _(VISUALS 1: AI GENERATION)_

Character reference
Reference-guided sword swing · autoplay

 OpenAI native image generation · reference image and attack poses [Actual prompts + sheet ↗](assets/native-swordsman/guide.md)

## 28. Asset review and iteration  _(VISUALS 1: AI GENERATION)_

Guard
Wind-up
Slash
Follow-through

Outfit consistency · hand placement · sword shape · timing

Give a separate critic the actual asset.
- Create
Generate from a reference and a small brief.

- Independent critique
A separate agent inspects the exported frames.

- In-game check
Test scale, timing and readability in the build.

- Revise
Fix the biggest issue and review again.

## 29. PixelLab  _(VISUALS 1: AI GENERATION)_

[image: PixelLab official dragon fire-breath example]PixelLab · fire breath
[image: PixelLab official ice-spike example]PixelLab · ice spikes

Specialist pixel workflows include animation, directions, tiles, and effects.
[PixelLab ↗](https://www.pixellab.ai)

## 30. Retro Diffusion  _(VISUALS 1: AI GENERATION)_

[image: Retro Diffusion gallery with characters, environments, tiles and effects]Retro Diffusion gallery reference · provided by Matt
[Styles and examples ↗](https://retrodiffusion.ai/styles/)[Walking workflow ↗](https://retrodiffusion.ai/styles/walking/)

## 31. Procedural generation  _(VISUALS 2: MADE WITH CODE)_

[image: Shader-generated surfaces from Claude of Duty]2D textures · generated with code
[image: Procedural rifle mesh]3D geometry · generated with code

Code builds the asset. It can run once to save a file, or every time the game starts.

## 32. Animation from code: Roofline  _(VISUALS 2: MADE WITH CODE)_

Autoplaying run cycle
The runner’s poses are drawn in code.
Leg positions change with the stride.
The body leans and the scarf moves.
Eight sampled poses · 12 fps preview
[Play Roofline ↗](https://game-assets-gauntlet.vercel.app/roofline/)

## 33. Pixel-art effects  _(VISUALS 2: MADE WITH CODE)_

Sprite Fusion · published heal and power-up demo
This heal effect is code.
Ask the agent for a few variations, compare the recordings, then tune the palette, particle count and timing.
[Workflow article ↗](https://www.spritefusion.com/blog/how-to-make-good-pixel-art-effects-with-claude)[Effect library + code ↗](https://www.spritefusion.com/pixel-art-vfx)
MIT TypeScript source. Port it or capture frames for another engine.

## 34. Library assets  _(VISUALS 3: ASSET LIBRARIES)_

[image: Kenney Tiny Dungeon 2D pack preview]2D · Kenney Tiny Dungeon
[image: Poly Haven Ship Pinnace model preview]3D · Poly Haven Ship Pinnace

Look for a coherent pack with the scale, camera, and license your game needs.
[2D pack ↗](https://kenney.nl/assets/tiny-dungeon)[3D library ↗](https://polyhaven.com)[Quaternius ↗](https://quaternius.com)

## 35. 2D tools by route  _(VISUAL TOOL DIRECTORY)_

1 · AI generation
[OpenAI · built in ↗](https://learn.chatgpt.com/docs/image-generation)Image prompts and edits
[Layer ↗](https://layer.ai/)Multi-model art workspace
[PixelLab ↗](https://www.pixellab.ai)Pixel sprites, directions, animation
[Retro Diffusion ↗](https://retrodiffusion.ai/styles/)Pixel-art styles and walk cycles
[AutoSprite ↗](https://www.autosprite.io/pricing)Animated, directional sprite sheets
[Ludo.ai ↗](https://ludo.ai/features/sprite-generator)Sprites and motion transfer
[Scenario ↗](https://www.scenario.com/pricing)Custom styles for a matching set
[Recraft ↗](https://www.recraft.ai/generate/icons)Icon sets and vector art

  2 · Made with code
[Sprite Fusion VFX ↗](https://www.spritefusion.com/pixel-art-vfx)Effect code you can tune
[Phaser ↗](https://github.com/phaserjs/template-vite)Draw shapes and particles in 2D
[Pillow ↗](https://pillow.readthedocs.io)Scripted image edits and sheets
[Aseprite CLI + Lua ↗](https://www.aseprite.org/docs/cli/)Export sheets and frame data

  3 · Asset libraries
[Kenney ↗](https://kenney.nl/assets)2D, UI and audio packs · CC0
[0x72 ↗](https://0x72.itch.io)Pixel-art dungeon packs
[CraftPix ↗](https://craftpix.net)2D characters and GUI
[GameArt2D ↗](https://www.gameart2d.com)Characters and tiles
[itch.io ↗](https://itch.io/game-assets)Indie packs · creator terms
[OpenGameArt ↗](https://opengameart.org)Community art · varied licenses

  Touch up
[Aseprite ↗](https://www.aseprite.org/)Paid pixel editor and animator
[Piskel ↗](https://www.piskelapp.com/)Free browser pixel editor
[LibreSprite ↗](https://libresprite.github.io)Free desktop pixel editor

Built-in generation uses plan limits. Specialist services have their own plans or credits.

## 36. 3D tools by route  _(VISUAL TOOL DIRECTORY)_

1 · AI generation
[Meshy ↗](https://www.meshy.ai/pricing/)Text or image to 3D model
[Tripo ↗](https://developers.tripo3d.com/en/models/animation)Models, plus rigging and animation
[Rodin / Hyper3D ↗](https://hyper3d.ai/pricing?lang=en)3D shape and textures
[Sloyd ↗](https://sloyd.gitbook.io/documentation)Adjustable props and buildings
[Skybox AI ↗](https://skybox.blockadelabs.com/plans)360° skies and HDRI lighting
[Layer ↗](https://layer.ai/)Images, sprites, 3D and audio

  2 · Made with code
[Three.js ↗](https://github.com/mrdoob/three.js)Geometry and materials in the browser
[Blender Python ↗](https://www.blender.org)Scripts that build and export scenes
[Blender MCP ↗](https://github.com/ahujasid/mcp-for-blender)Lets the agent run Blender
[Claude of Duty ↗](https://github.com/mshumer/Claude-of-Duty)Example: a whole game from code

  3 · Asset libraries
[Poly Haven ↗](https://polyhaven.com)Models, materials, HDRIs · CC0
[Quaternius ↗](https://quaternius.com)Low-poly packs and animations
[KayKit ↗](https://kaylousberg.itch.io)Matching low-poly families
[ambientCG ↗](https://ambientcg.com)Tileable materials
[Fab ↗](https://www.fab.com)3D assets, materials, VFX
[Synty ↗](https://syntystore.com)Paid low-poly families

  Rig and animate
[Mixamo ↗](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html)Auto-rig humanoids, motion library
[Quaternius animations ↗](https://quaternius.com/packs/universalanimationlibrary2.html)CC0 humanoid clips
[Fox sample ↗](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox)Rigged test model: walk, run
[glTF / GLB ↗](https://www.khronos.org/gltf/)Common format for engines

Generated models still need a check of shape, textures and rig in your engine.

## 37. Characters  _(VISUAL ASSET TYPES)_

2D · Fry’s hero walk · CC0
[image: Lecture robot model with its skeleton shown]3D · one model with a skeleton

A sprite needs new frames for each view. A 3D model reuses one skeleton and its clips.

## 38. Objects and pickups  _(VISUAL ASSET TYPES)_

[image: QuizCaster shop stall]World prop
[image: QuizCaster healing pickup]Pickup / icon
[image: Poly Haven ship pinnace model]3D prop · Poly Haven

A visible object still needs scale, placement, interaction, and collision.

## 39. Environments  _(VISUAL ASSET TYPES)_

[image: QuizCaster terrain trail tile]2D · repeating terrain and transitions
[image: Pastel Nuketown 3D environment]3D · space, materials, and lighting

Test seams, scale, and the camera before adding detail.

## 40. Backgrounds and skyboxes  _(VISUAL ASSET TYPES)_

[image: Official Kenney 2D background elements preview]2D · layered background images
Sky, distant scenery, foreground detail
- Skybox concept diagram
3D · a background around the scene
Surrounding sky or a panoramic image

The background players see and the light on objects can be set separately.

## 41. UI and typography  _(VISUAL ASSET TYPES)_

HUD · during play
 3 / 4
◆ 024

Health and currency stay visible.

  Pause & settings
PAUSEDResume ↵
Music   ━━━●━
Show the selected action and settings.

  Menu & inventory
⚔1✚2◆3
Make the selected item obvious.

  Type & feedback
LEVEL UPRestore 20 health✓ Saved
Short labels, readable details, clear response.

Original HTML / SVG interface examples · illustrative, static   [Find fonts ↗](https://fonts.google.com)

## 42. Textures and materials  _(VISUAL ASSET TYPES)_

[image: Actual brick diffuse color texture from Poly Haven]Base color
The surface color

 [image: Actual purple and blue OpenGL normal map for the same brick texture]Normal
Small surface detail

 [image: Actual grayscale roughness map for the same brick texture]Roughness
How reflections spread

Actual CC0 maps: Brick Wall 001
Dimitrios Savva / Rob Tuytel · [Poly Haven ↗](https://polyhaven.com/a/brick_wall_001)
Texture: an image that supplies color or detail.
Material: surface settings that control how light reacts. It can use textures.

 One parameter changed
[image: Rendered brass sphere with roughness 0.08 and a sharp reflection]Roughness 0.08
[image: Same brass sphere and lighting, roughness 0.80 and broad reflections]Roughness 0.80

The shape and lighting stay the same.
Original Blender renders. The brass study is separate from the brick maps.

## 43. Lighting  _(VISUAL ASSET TYPES)_

[image: Same ochre cube and gray sphere under a large warm area light]Large, warm light
Soft shadows
[image: Same ochre cube and gray sphere under a small warm side light]Small side light
Hard shadows
[image: Same ochre cube and gray sphere under a cool light from behind]Cool light from behind
A different mood

Same objects and camera in all three.
Moving the light changes what players notice.
A larger light gives softer shadows.

Original Blender renders · A light setup is part of the scene, even when the model comes from a library.

## 44. Sprite sheet  _(2D ANIMATION)_

Five frames played in a loop
QuizCaster blob · 150 ms per frame
Each frame keeps the same cell size and ground position.

## 45. Pixel editing  _(2D ANIMATION)_

[image: Aseprite canvas above a timeline of layers and animation frames]Aseprite interface demonstration · aseprite.org

        Fix a stray pixel or recolor a sprite with the pencil and palette.

        Edit frames on the timeline, preview the loop, then export a sprite sheet.

        [Aseprite · paid desktop ↗](https://www.aseprite.org/)
[Piskel · free browser editor ↗](https://www.piskelapp.com/)

## 46. The parts of a 3D scene  _(3D MODELS AND ANIMATION)_

[image: Roadster mesh rendered with one neutral material]Neutral material
[image: Same Roadster mesh with red paint, glass and rubber materials]Paint, glass and rubber

The mesh, camera and lights stay the same in both renders.
Mesh + surface+Light + camera→Rendered image

In the model
MeshConnected polygon faces form the shape.
Texture mapsImages supply color, roughness or surface detail.
UV mapThe layout that wraps image textures onto the mesh.
MaterialSurface rules control reflection and transparency.
In the scene
LightingLamps and environment light illuminate the scene.
CameraThe viewpoint used to render the image.

## 47. 3D: give the model movement  _(3D MODELS AND ANIMATION)_

A rig is a skeleton that bends the model. A clip is a saved movement, like this run.
The bones move; the model follows. Same run on both sides.
Fox: PixelMannen · Rig and animation: tomkranis · glTF: AsoboStudio / scurest · CC BY 4.0

## 48. Audio assets  _(AUDIO ASSETS)_

Sound effects, ambience, music and voice.

## 49. Audio asset types  _(AUDIO ASSETS)_

[image: QuizCaster spell effects, illustrative context][image: Actual spell cast waveform]
Gameplay SFX
Spell cast
Play0:00
JaggedStone · CC0

Spell power +20%Upgrade applied ✓[image: Actual confirmation waveform]
UI feedback
Confirm
Play0:00
JaggedStone · CC0

[image: Sky Roadster driving context][image: Actual car interior waveform]
Ambience
Driving
Play0:00
artemditkovsky · CC0

Music · 10 s[image: Ten-second music waveform]Reward · 1.54 s[image: Reward waveform on the same ten-second scale]
Music & stings
Reward
Play0:00
JaggedStone · CC0

“Ready?”[image: Actual Ready voice recording waveform]
Voice
Ready
Play0:00
Kenney / Giselle · CC0

## 50. Three ways to get audio  _(AUDIO ASSETS)_

1AI generation
ElevenLabs output[image: Waveform of the actual generated music excerpt]Prompt → audio file
Describe the sound and how long it lasts. A model returns an audio file.
ElevenLabs sound effects and music

  2Made with code
[image: Actual jsfxr preset and sound parameter editor]The agent sets synth parameters or writes code that creates the sound.
jsfxr · Bfxr · Web Audio

  3Asset libraries
Magic Spell SFX · JaggedStoneSpell cast1.61 s · CC0
[image: Waveform of the library spell example]Artist-made library recording
Recordings and packs that sound designers have already made.
Kenney · Freesound · Sonniss

## 51. Generative audio  _(AUDIO 1: AI GENERATION)_

Describe the sound and how long it lasts.
The model returns an audio file.

Glass break
Play0:00
ElevenLabs · crystalline shatter

Reconstruction
Play0:00
ElevenLabs · magnetic assembly

Music excerpt
Play0:00
ElevenLabs · 10-second instrumental excerpt

## 52. Sound effects made with code  _(AUDIO 2: MADE WITH CODE)_

Code can layer sound into a complete effect.
Choose a preset such as coin, laser, or jump. Adjust the sliders or mutate a variation, then export a WAV.
[Open jsfxr ↗](https://sfxr.me)
jsfxr and Bfxr handle retro cues. These examples use custom synthesis code.

[image: Actual jsfxr interface with presets, waveform and parameter sliders]Energy blast
Play0:00
Original layered code synthesis · Dead Circuit

Mechanical recharge
Play0:00
Original layered code synthesis · Dead Circuit

## 53. Sound libraries  _(AUDIO 3: ASSET LIBRARIES)_

[Kenney ↗](https://kenney.nl/assets/interface-sounds)[Freesound ↗](https://freesound.org)[OpenGameArt ↗](https://opengameart.org)[Sonniss ↗](https://sonniss.com/)[A Sound Effect ↗](https://www.asoundeffect.com/)
Free and paid collections. Check the terms of the pack you pick.

Spell cast
Play0:00
JaggedStone · Magic Spell SFX · CC0

Air blast
Play0:00
1histori · Freesound · CC0

More Kenney recordings play in the audio-type slides that follow.

## 54. Audio tools by route  _(AUDIO TOOL DIRECTORY)_

1 · AI generation
[ElevenLabs ↗](https://elevenlabs.io/sound-effects)Sound effects from a text prompt
[Layer ↗](https://layer.ai/)Workspace that includes audio
[Suno ↗](https://suno.com/tools/ai-music-generator)Songs and instrumental music
[Stable Audio ↗](https://stableaudio.com/guide)Music, effects and ambience

  2 · Made with code
[jsfxr ↗](https://sfxr.me)Browser synth with game presets
[jsfxr library ↗](https://github.com/chr15m/jsfxr)Same synth inside your game code
[Bfxr ↗](https://www.bfxr.net)Sound-design editor
[Bfxr source ↗](https://github.com/increpare/bfxr2)Seeded presets you can embed

  3 · Asset libraries
[Kenney Impact Sounds ↗](https://kenney.nl/assets/impact-sounds)Footsteps and hits · CC0
[Kenney Interface Sounds ↗](https://kenney.nl/assets/interface-sounds)Clicks and confirms · CC0
[Kenney Voiceover Pack ↗](https://opengameart.org/content/voiceover-pack-40-lines)Human voice lines · CC0
[Freesound ↗](https://freesound.org)Huge archive · per-sound licenses
[Sonniss ↗](https://sonniss.com/)Pro libraries, free bundles
[A Sound Effect ↗](https://www.asoundeffect.com/)Paid professional packs

  Edit and import
[Audacity ↗](https://www.audacityteam.org)Trim, fade, check loops
[Noise reduction ↗](https://manual.audacityteam.org/man/noise_reduction.html)Clean steady background hiss
[Godot audio import ↗](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_audio_samples.html)Looping and compression
[Unreal audio import ↗](https://dev.epicgames.com/documentation/unreal-engine/importing-audio-files)Formats and import settings

Play every sound in the game at its real volume before you keep it. [42 tools and libraries ↗](asset-options.md)

## 55. Gameplay SFX  _(AUDIO ASSET TYPES)_

[image: QuizCaster spell effects during combat]QuizCaster · visual context
Spell cast1.61 s
[image: Waveform of Spell cast]01.61 s

A sound starts when the action fires. Illustration: QuizCaster; sample: JaggedStone.
Sound tied to actions in the world
Spell cast
Play0:00
JaggedStone · Magic Spell SFX · CC0

Air blast
Play0:00
1histori · recorded compressed air · CC0

[Spell pack ↗](https://opengameart.org/content/magic-spell-sfx) / [Recording credits ↗](assets/audio-upgrade/credits.md)

## 56. UI feedback  _(AUDIO ASSET TYPES)_

Choose an upgradeFire rate+15%
Spell power+20%Selected ✓
Upgrade applied

Upgrade confirmation1.38 s
[image: Waveform of Upgrade confirmation]01.38 s

Play a confirmation when the upgrade is accepted. Original interface study.
Feedback for menus and HUD actions
Confirm an upgrade
Play0:00
JaggedStone · Magic Spell SFX · CC0

Upgrade accepted · inventory confirmation
[Source pack ↗](https://opengameart.org/content/magic-spell-sfx)

## 57. Ambience  _(AUDIO ASSET TYPES)_

[image: Sky Roadster driving along a coastal road]Sky Roadster · driving context
Recorded car interior5.75 s
[image: Waveform of Recorded car interior]05.75 s

Road noise continues between player actions. The sample is a real car-interior recording.
The background sound of a place
Inside a moving car
Play0:00
artemditkovsky · location recording · CC0

Road noise and cabin vibration · background layer
[Recording source ↗](assets/audio-upgrade/credits.md)

## 58. Music & stings  _(AUDIO ASSET TYPES)_

Music bed10.00 s
[image: Actual 10-second instrumental waveform]
Reward accent1.54 s
[image: Actual 1.54-second reward waveform on the same 10-second scale]
0 s246810 s

Both tracks share a 10-second ruler. The reward accent ends after 1.54 seconds.
A score for the scene and cues for rewards
Music bed
Play0:00
Existing ElevenLabs instrumental · 10-second excerpt

Reward accent
Play0:00
JaggedStone · Magic Spell SFX · CC0

[Reward source pack ↗](https://opengameart.org/content/magic-spell-sfx)

## 59. Voice  _(AUDIO ASSET TYPES)_

Announcer line“Mission
completed.”Jeffrey M. Smith · human recording
Mission completed1.26 s
[image: Waveform of Mission completed]01.26 s

Keep a text equivalent for spoken information the player needs.
Announcers and character dialogue
Ready?
Play0:00
Giselle · Kenney Voiceover Pack · CC0

Mission completed
Play0:00
Jeffrey M. Smith · Kenney Voiceover Pack · CC0

[Voice pack and credits ↗](https://opengameart.org/content/voiceover-pack-40-lines)

## 60. Workflows and tools  _(AGENT SKILLS AND EDITORS)_

Skills describe the work. Editor connections let an agent carry it out.

## 61. Game-dev skills collection  _(AGENT SKILLS AND EDITORS)_

77 skills
[awesome-gamedev-agent-skills ↗](https://github.com/gamedev-skills/awesome-gamedev-agent-skills)
Godot, Unity, Unreal, Phaser, Three.js, and other engines.

Across the project
Asset creationAnimationProcedural generationLevel designAudio designGame feelTestingPublishing
Engine, discipline, genre, and workflow guides.

“Add a double jump to my Godot player.”
Router selects Godot 2D movement + platformer skills.

[Browse the full catalog ↗](https://gamedev-skills.github.io/awesome-gamedev-agent-skills/)[Asset workflow ↗](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/19d93f97c9c1/skills/disciplines/create-game-assets/SKILL.md)[Prototyping workflow ↗](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/19d93f97c9c1/skills/workflows/prototype-fast/SKILL.md)

## 62. Engine starting points  _(AGENT SKILLS AND EDITORS)_

Browser
[Phaser starter ↗](https://github.com/phaserjs/template-vite) · 2D
[Three.js ↗](https://github.com/mrdoob/three.js) · 3D
[Asset-loading skill ↗](https://github.com/phaserjs/phaser/blob/02d8931b626d/skills/loading-assets/SKILL.md) / [glTF skill ↗](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/19d93f97c9c1/skills/web-engines/threejs-gltf-loading/SKILL.md)

Godot
[Official learning path ↗](https://docs.godotengine.org/en/stable/about/introduction.html)
[Scene and testing skills ↗](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/19d93f97c9c1/skills/godot/godot-nodes-scenes/SKILL.md)

Unity
[Unity Learn ↗](https://learn.unity.com)
[Animation skill ↗](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/19d93f97c9c1/skills/unity/unity-animation/SKILL.md)

Unreal
[Official learning path ↗](https://dev.epicgames.com/community/unreal-engine/learning)
[Blueprint skill ↗](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/19d93f97c9c1/skills/unreal/unreal-blueprints/SKILL.md)

Choose your engine, then use its starter, documentation, and matching skills.

## 63. Editor connections  _(AGENT SKILLS AND EDITORS)_

Godot
[Godot MCP ↗](https://github.com/Coding-Solo/godot-mcp)
Run the project and inspect output.

Unity
[MCP for Unity ↗](https://github.com/CoplayDev/unity-mcp)
Edit scenes, assets, and scripts.

Unreal
[Editor scripting ↗](https://dev.epicgames.com/documentation/en-us/unreal-engine/scripting-and-automating-the-unreal-editor)
Python and editor utilities.

Blender
[Blender MCP ↗](https://github.com/ahujasid/mcp-for-blender)
Inspect scenes and run Python.

Aseprite
[Live canvas bridge ↗](https://github.com/giangdvdotdev/aseprite-mcp)
[Batch bridge ↗](https://github.com/Vollkorn-Games/aseprite-mcp)

MCP gives an agent access to a tool. Check the bridge's supported version and actions.

## 64. Built-in editor automation  _(AGENT SKILLS AND EDITORS)_

Godot
[Command line ↗](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html)
Import, run, export, inspect logs.

Unity
[C# editor scripts ↗](https://docs.unity3d.com/Manual/ExtendingTheEditor.html)
Custom tools and batch jobs.

Unreal
[Python scripting ↗](https://dev.epicgames.com/documentation/en-us/unreal-engine/scripting-the-unreal-editor-using-python)
[Editor utilities ↗](https://dev.epicgames.com/documentation/en-us/unreal-engine/scripting-and-automating-the-unreal-editor)

Blender
[Python + batch ↗](https://www.blender.org)
Build scenes and automate exports.

Aseprite
[CLI + Lua ↗](https://www.aseprite.org/docs/cli/)
Export sheets, tags, and metadata.

An agent can write scripts for the editor's existing automation interface.

## 65. Game Dev Cheat Sheet  _(GAME DEV CONCEPTS)_

[image: Nicolas Zullo’s interactive guide showing a live delta-time comparison and prompt example]Nicolas Zullo · 34 interactive concepts
[OPEN INTERACTIVE GUIDE ↗](https://gamedev-cheatsheet.com/)[3D & rendering ↗](https://gamedev-cheatsheet.com/#chapter-3d)[Game feel ↗](https://gamedev-cheatsheet.com/#chapter-feel)[Systems ↗](https://gamedev-cheatsheet.com/#chapter-systems)[Performance ↗](https://gamedev-cheatsheet.com/#chapter-perf)
Opens a scrollable page in a separate tab.
Internet required.

## 66. Game-dev communities  _(COMMUNITIES)_

r/aigamedev ↗AI-assisted workflows and build breakdownsr/StableDiffusion ↗Open and local image workflowsr/gamedev ↗Production, postmortems and developmentr/gamedesign ↗Mechanics, pacing and player decisionsr/gameassets ↗Existing asset packs and licensingNo AI asset postsr/playmygame ↗Feedback on a playable build
[Community guide and posting rules ↗](communities.md)

## 67. Engine and craft communities  _(COMMUNITIES)_

r/godot ↗Godot engine helpr/Unity3D ↗Unity engine helpr/unrealengine ↗Unreal engine helpr/blenderhelp ↗Modeling, UVs and materialsr/PixelArt ↗Palettes, sprites and pixel techniqueNo partly AI artr/GameAudio ↗Game sound and audio implementation
[Community guide and posting rules ↗](communities.md)

## 68. Game demos  _(GAME DEMOS)_

Five small games and the assets behind them.

## 69. Roofline  _(GAME DEMOS)_

[image: Actual Roofline gameplay]Actual gameplay
Momentum-based rooftop running
ArtCode-drawn pixel art
AnimationCode-drawn poses and effects
SFXRecorded foley + synthesized cues
MusicGenerated with ElevenLabs
[PLAY GAME ↗](https://game-assets-gauntlet.vercel.app/roofline/)Opens a separate game tab · internet required

## 70. Sky Roadster  _(GAME DEMOS)_

[image: Actual Sky Roadster gameplay on the coastal road]Actual gameplay
Checkpoint racing with a flying car
ArtLibrary models + code-built scenery
AnimationVehicle motion and thrust VFX in code
SFXRecorded vehicle and air sounds
MusicGenerated with ElevenLabs
[PLAY GAME ↗](https://game-assets-gauntlet.vercel.app/sky-roadster/)Opens a separate game tab · internet required

## 71. Dewbound  _(GAME DEMOS)_

[image: Dewbound beetle exploring a garden clearing with an ant and rival beetle]Actual gameplay
A beetle adventure in a garden
ArtCode-drawn 2D artwork
AnimationArticulated movement in code
SFXRecorded sounds + synthesized layers
MusicGenerated with ElevenLabs
[PLAY GAME ↗](https://game-assets-gauntlet.vercel.app/dewbound/)Opens a separate game tab · internet required

## 72. Aftershock  _(GAME DEMOS)_

[image: Actual Aftershock gameplay]Actual gameplay
Chain-reaction space combat
ArtCode-drawn pixel art
AnimationCode-built particles and effects
SFXWeb Audio synthesis
MusicGenerated with ElevenLabs
[PLAY GAME ↗](https://game-assets-gauntlet.vercel.app/aftershock/)Opens a separate game tab · internet required

## 73. Jelly Drop  _(GAME DEMOS)_

[image: Actual Jelly Drop mid-game at 200 points with a 47 percent full jar and four jelly colors]Actual gameplay
An endless soft-body puzzle
ArtAI-generated scene art + code-rendered jelly
AnimationSoft-body physics
SFXWeb Audio synthesis
MusicGenerated with ElevenLabs
[PLAY GAME ↗](https://game-assets-gauntlet.vercel.app/jelly/)Opens a separate game tab · internet required

## 74. Lecture resources  _(RESOURCES AND Q/A)_

Browse the lecture links by topic.
[game-assets-gauntlet.vercel.app](https://game-assets-gauntlet.vercel.app)[OPEN RESOURCE GUIDE ↗](?resources=1)Download the deck and exact image prompts.

Visual assets ↗Sprites, 3D models, materials, VFXSound & music ↗Libraries, synths, generated audioEngines & editors ↗Starters, docs, import workflowsSkills & automation ↗Agent skills, MCPs, scripting, repos

## 75. END  _(RESOURCES AND Q/A)_

[game-assets-gauntlet.vercel.app](?resources=1)

## 76. Q/A  _(RESOURCES AND Q/A)_



