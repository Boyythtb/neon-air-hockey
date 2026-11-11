import * as THREE from 'three';

export class ParticleFX {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
  }

  // Bắn tia lửa va chạm nhuyễn đẹp mắt
  createHitSparks(x, z, colorHex = 0xf43f5e, count = 14) {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.11, 8, 8);
      const mat = new THREE.MeshBasicMaterial({ color: colorHex });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 0.25, z);
      this.scene.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const speed = 3.5 + Math.random() * 6.5;
      this.particles.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vz: Math.sin(angle) * speed,
        vy: 1.8 + Math.random() * 2.8,
        life: 0.32 + Math.random() * 0.18,
        maxLife: 0.5
      });
    }
  }

  // Vòng sóng xung kích lan tỏa (Shockwave ring khi smash)
  createShockwave(x, z, colorHex = 0xf43f5e) {
    const geo = new THREE.RingGeometry(0.2, 0.45, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.04, z);
    this.scene.add(ring);

    this.particles.push({
      mesh: ring,
      isRing: true,
      scale: 1,
      opacity: 0.85,
      life: 0.32
    });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      if (p.isRing) {
        p.scale += dt * 16;
        p.mesh.scale.set(p.scale, p.scale, p.scale);
        p.mesh.material.opacity = (p.life / 0.32) * 0.85;
      } else {
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.z += p.vz * dt;
        p.mesh.position.y += p.vy * dt;
        p.vy -= 16 * dt; // Trọng lực nhẹ
        if (p.mesh.position.y < 0.1) p.mesh.position.y = 0.1;
        p.mesh.scale.setScalar(p.life * 2.6);
      }
    }
  }
}
