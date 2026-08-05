import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

const DEFAULT_ORGANIZATION_ID = 1;
const BCRYPT_ROUNDS = 10;

interface JwtPayload {
  sub: number;
  organizationId: number;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async signup(dto: SignupDto): Promise<{ accessToken: string }> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        organizationId: DEFAULT_ORGANIZATION_ID,
        email: dto.email,
        name: dto.name,
        passwordHash,
      },
    });

    return { accessToken: this.signToken(user.id, user.organizationId, user.email) };
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) throw new UnauthorizedException('Invalid credentials');

    return { accessToken: this.signToken(user.id, user.organizationId, user.email) };
  }

  private signToken(userId: number, organizationId: number, email: string): string {
    const payload: JwtPayload = { sub: userId, organizationId, email };
    return this.jwt.sign(payload);
  }
}
