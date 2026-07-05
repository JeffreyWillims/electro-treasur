"""
tests/unit/test_agents.py — Agent Subsystem Unit Tests.

Без БД и без реальных subprocess-запусков тяжёлых инструментов:
  • SkillRegistry — регистрация, дубликаты, поиск;
  • file_skills — чтение/запись/список + ПЕСОЧНИЦА (выход за root запрещён);
  • test_skills — чистые build_*-команды + run_command на лёгких командах;
  • BackendAgent — загрузка инструкций/правил из docs/, fail-fast verify;
  • Orchestrator — реестр ролей, ошибки на дубликат/отсутствие.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from src.agents import BackendAgent, Orchestrator, Skill, SkillRegistry, SkillResult
from src.agents.skills import file_skills, test_skills


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SkillRegistry
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def _noop_skill(name: str) -> Skill:
    return Skill(name, f"test skill {name}", lambda: SkillResult(ok=True, output=""))


class TestSkillRegistry:
    def test_register_and_get(self) -> None:
        reg = SkillRegistry()
        skill = _noop_skill("alpha")
        reg.register(skill)
        assert reg.get("alpha") is skill

    def test_duplicate_name_raises(self) -> None:
        reg = SkillRegistry()
        reg.register(_noop_skill("alpha"))
        with pytest.raises(ValueError, match="already registered"):
            reg.register(_noop_skill("alpha"))

    def test_missing_skill_raises_with_available_list(self) -> None:
        reg = SkillRegistry()
        reg.register(_noop_skill("alpha"))
        with pytest.raises(KeyError, match="alpha"):
            reg.get("beta")

    def test_names_sorted(self) -> None:
        reg = SkillRegistry()
        reg.register(_noop_skill("zeta"))
        reg.register(_noop_skill("alpha"))
        assert reg.names() == ["alpha", "zeta"]

    def test_describe_lists_skills(self) -> None:
        reg = SkillRegistry()
        reg.register(_noop_skill("alpha"))
        assert "alpha" in reg.describe()
        assert SkillRegistry().describe() == "<no skills registered>"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# file_skills — песочница обязательна
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestFileSkills:
    def test_write_then_read_roundtrip(self, tmp_path: Path) -> None:
        write = file_skills.write_file(tmp_path, "sub/dir/note.txt", "hello agents")
        assert write.ok
        read = file_skills.read_file(tmp_path, "sub/dir/note.txt")
        assert read.ok
        assert read.output == "hello agents"

    def test_read_missing_file_fails_gracefully(self, tmp_path: Path) -> None:
        result = file_skills.read_file(tmp_path, "ghost.txt")
        assert not result.ok
        assert "Not a file" in result.output

    def test_path_escape_via_dotdot_rejected(self, tmp_path: Path) -> None:
        for action in (
            lambda: file_skills.read_file(tmp_path, "../outside.txt"),
            lambda: file_skills.write_file(tmp_path, "../outside.txt", "x"),
        ):
            result = action()
            assert not result.ok
            assert "escapes project root" in result.output

    def test_absolute_path_rejected(self, tmp_path: Path) -> None:
        result = file_skills.read_file(tmp_path, "/etc/passwd")
        assert not result.ok
        assert "Absolute paths are not allowed" in result.output

    def test_read_oversized_file_rejected(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        (tmp_path / "big.txt").write_text("x" * 100)
        monkeypatch.setattr(file_skills, "MAX_READ_BYTES", 10)
        result = file_skills.read_file(tmp_path, "big.txt")
        assert not result.ok
        assert "exceeds" in result.output

    def test_list_files_glob(self, tmp_path: Path) -> None:
        (tmp_path / "a.py").write_text("")
        (tmp_path / "b.txt").write_text("")
        (tmp_path / "pkg").mkdir()
        (tmp_path / "pkg" / "c.py").write_text("")
        result = file_skills.list_files(tmp_path, "**/*.py")
        assert result.ok
        assert result.output.splitlines() == ["a.py", "pkg/c.py"]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# test_skills — build_* чистые, run_command на лёгких командах
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestBuildCommands:
    def test_ruff_and_mypy_commands(self) -> None:
        assert test_skills.build_ruff_command() == ["ruff", "check", "."]
        assert test_skills.build_mypy_command() == ["mypy", "src/"]

    def test_pytest_default_matches_ci_shape(self) -> None:
        cmd = test_skills.build_pytest_command()
        assert cmd[:1] == ["pytest"]
        assert "tests/unit" in cmd and "tests/integration" in cmd
        assert cmd[cmd.index("-m") + 1] == "not e2e"
        assert "--cov=src" not in cmd  # покрытие только по явному запросу

    def test_pytest_with_coverage_and_custom_paths(self) -> None:
        cmd = test_skills.build_pytest_command(
            paths=["tests/unit"], marker=None, with_coverage=True
        )
        assert "tests/unit" in cmd
        assert "tests/integration" not in cmd
        assert "-m" not in cmd
        assert "--cov=src" in cmd and "--cov-fail-under=70" in cmd


class TestRunCommand:
    def test_success_captures_stdout(self, tmp_path: Path) -> None:
        result = test_skills.run_command(["echo", "ok-marker"], cwd=tmp_path)
        assert result.ok
        assert "ok-marker" in result.output

    def test_nonzero_exit_is_not_ok(self, tmp_path: Path) -> None:
        result = test_skills.run_command(["false"], cwd=tmp_path)
        assert not result.ok

    def test_missing_binary_fails_gracefully(self, tmp_path: Path) -> None:
        result = test_skills.run_command(["no-such-binary-xyz"], cwd=tmp_path)
        assert not result.ok
        assert "Command not found" in result.output

    def test_timeout_fails_gracefully(self, tmp_path: Path) -> None:
        result = test_skills.run_command(["sleep", "5"], cwd=tmp_path, timeout=1)
        assert not result.ok
        assert "Timeout" in result.output


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# BackendAgent — база знаний реально существует, verify fail-fast
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestBackendAgent:
    def test_loads_real_instructions_and_rules(self) -> None:
        agent = BackendAgent()
        assert "Backend Agent" in agent.load_instructions()
        assert "Backend Rules" in agent.load_rules()

    def test_registers_expected_skills(self) -> None:
        agent = BackendAgent()
        assert agent.skills.names() == [
            "list_files",
            "read_file",
            "run_mypy",
            "run_pytest",
            "run_ruff",
            "write_file",
        ]

    def test_verify_runs_ci_order_and_stops_on_failure(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        calls: list[str] = []

        def fake_step(name: str, ok: bool) -> object:
            def _step(cwd: Path) -> SkillResult:
                calls.append(name)
                return SkillResult(ok=ok, output=name)

            return _step

        monkeypatch.setattr(test_skills, "run_ruff", fake_step("ruff", True))
        monkeypatch.setattr(test_skills, "run_mypy", fake_step("mypy", False))
        monkeypatch.setattr(test_skills, "run_pytest", fake_step("pytest", True))

        results = BackendAgent().verify(tmp_path)

        assert calls == ["ruff", "mypy"]  # pytest не запускался — fail-fast
        assert [r.ok for r in results] == [True, False]

    def test_verify_all_green_runs_full_chain(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        for name in ("run_ruff", "run_mypy", "run_pytest"):
            monkeypatch.setattr(test_skills, name, lambda cwd: SkillResult(ok=True, output=""))
        results = BackendAgent().verify(tmp_path)
        assert len(results) == 3
        assert all(r.ok for r in results)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Orchestrator
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestOrchestrator:
    def test_register_and_get(self) -> None:
        orch = Orchestrator()
        agent = BackendAgent()
        orch.register(agent)
        assert orch.get("backend") is agent
        assert orch.roles() == ["backend"]

    def test_duplicate_role_raises(self) -> None:
        orch = Orchestrator()
        orch.register(BackendAgent())
        with pytest.raises(ValueError, match="already registered"):
            orch.register(BackendAgent())

    def test_unknown_role_raises_with_available(self) -> None:
        orch = Orchestrator()
        orch.register(BackendAgent())
        with pytest.raises(KeyError, match="backend"):
            orch.get("frontend")

    def test_verify_delegates_to_agent(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        for name in ("run_ruff", "run_mypy", "run_pytest"):
            monkeypatch.setattr(test_skills, name, lambda cwd: SkillResult(ok=True, output=""))
        orch = Orchestrator()
        orch.register(BackendAgent())
        results = orch.verify("backend", tmp_path)
        assert len(results) == 3 and all(r.ok for r in results)
